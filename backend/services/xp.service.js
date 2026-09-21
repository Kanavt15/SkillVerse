/**
 * XP and levelling.
 *
 * Changes from the MySQL implementation:
 *
 *   - XP values and the level curve come from PlatformSettings instead of
 *     being literals in this file, which is what the spec means by
 *     "configurable by the administrator" (§5, §21).
 *
 *   - The level curve is now self-inverse. The old code used
 *     `floor((xp/100)^(2/3)) + 1` to get a level and `100*(level-1)^1.5` to get
 *     the XP for one — two formulas that are not inverses, so "XP into the
 *     current level" could come out negative. Both directions now derive from
 *     one curve in PlatformSettings.
 *
 *   - `awardXP` is a single atomic `$inc` rather than UPDATE-then-SELECT, so
 *     concurrent awards cannot lose each other's increments.
 *
 *   - The daily XP cap is actually enforced. `checkDailyXPLimit` existed before
 *     but had zero call sites, so the configured caps did nothing.
 */

const XpTransaction = require('../models/XpTransaction');
const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');

/**
 * How many times this user has already been awarded `eventType` today.
 * Used to enforce the configured per-day caps.
 */
async function countTodaysAwards(userId, eventType, session = null) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return XpTransaction.countDocuments({
        user: userId,
        eventType,
        createdAt: { $gte: startOfDay },
    }).session(session);
}

/**
 * Award XP and record it in the ledger.
 *
 * @returns {{xpAwarded, newXP, newLevel, previousLevel, leveledUp, capped}}
 */
async function awardXP(userId, opts, session = null) {
    const {
        amount, eventType, description = '',
        referenceId = null, referenceType = null,
        dailyLimit = null,
    } = opts;

    const settings = await PlatformSettings.getSettings();

    if (!amount || amount <= 0) {
        return { xpAwarded: 0, newXP: null, newLevel: null, leveledUp: false, capped: false };
    }

    // Enforce the per-day cap where one is configured.
    if (dailyLimit != null) {
        const already = await countTodaysAwards(userId, eventType, session);
        if (already >= dailyLimit) {
            return { xpAwarded: 0, newXP: null, newLevel: null, leveledUp: false, capped: true };
        }
    }

    // Atomic increment; no read-modify-write window.
    const updated = await User.findByIdAndUpdate(
        userId,
        { $inc: { xp: amount } },
        { new: true, session }
    ).select('xp level');

    if (!updated) {
        return { xpAwarded: 0, newXP: null, newLevel: null, leveledUp: false, capped: false };
    }

    await XpTransaction.create([{
        user: userId,
        amount,
        eventType,
        description,
        referenceId,
        referenceType,
    }], { session });

    const previousLevel = updated.level;
    const newLevel = settings.levelForXP(updated.xp);
    const leveledUp = newLevel > previousLevel;

    if (leveledUp) {
        await User.updateOne({ _id: userId }, { $set: { level: newLevel } }, { session });
    }

    return {
        xpAwarded: amount,
        newXP: updated.xp,
        newLevel,
        previousLevel,
        leveledUp,
        capped: false,
    };
}

/**
 * XP for completing a lesson, plus the once-a-day first-lesson bonus.
 */
async function awardLessonXP(userId, lessonId, lessonTitle, isFirstActivityToday, session = null) {
    const settings = await PlatformSettings.getSettings();
    const { xpRules } = settings;

    const base = await awardXP(userId, {
        amount: xpRules.lessonComplete,
        eventType: 'lesson_complete',
        description: `Completed lesson: ${lessonTitle}`,
        referenceId: lessonId,
        referenceType: 'lesson',
    }, session);

    let bonus = { xpAwarded: 0 };
    if (isFirstActivityToday && xpRules.firstLessonDaily > 0) {
        bonus = await awardXP(userId, {
            amount: xpRules.firstLessonDaily,
            eventType: 'first_lesson_daily',
            description: 'First lesson of the day',
            referenceId: lessonId,
            referenceType: 'lesson',
        }, session);
    }

    return {
        totalXP: base.xpAwarded + bonus.xpAwarded,
        lessonXP: base.xpAwarded,
        bonusXP: bonus.xpAwarded,
        // The later award reflects the final state.
        newXP: bonus.newXP ?? base.newXP,
        newLevel: bonus.newLevel ?? base.newLevel,
        previousLevel: base.previousLevel,
        leveledUp: base.leveledUp || bonus.leveledUp,
    };
}

/** XP for finishing a whole course. */
async function awardCourseXP(userId, courseId, courseTitle, difficulty, session = null) {
    const settings = await PlatformSettings.getSettings();

    return awardXP(userId, {
        amount: settings.xpRules.courseComplete,
        eventType: 'course_complete',
        description: `Completed course: ${courseTitle}`,
        referenceId: courseId,
        referenceType: 'course',
    }, session);
}

/** Bonus XP on hitting a streak milestone. */
async function awardStreakBonusXP(userId, streakDays, session = null) {
    const settings = await PlatformSettings.getSettings();
    const amount = settings.xpRules.streakBonuses?.get(String(streakDays));

    // Not every milestone carries a bonus — the streak service celebrates a
    // 3-day streak, but the reward table starts at 7.
    if (!amount) return { xpAwarded: 0, leveledUp: false };

    return awardXP(userId, {
        amount,
        eventType: 'streak_bonus',
        description: `${streakDays}-day streak milestone`,
        referenceType: 'streak',
    }, session);
}

/** XP for solving a problem, scaled by difficulty. */
async function awardProblemXP(userId, problemId, problemTitle, difficulty, session = null) {
    const settings = await PlatformSettings.getSettings();
    const byDifficulty = {
        easy: settings.xpRules.problemEasy,
        medium: settings.xpRules.problemMedium,
        hard: settings.xpRules.problemHard,
    };

    return awardXP(userId, {
        amount: byDifficulty[difficulty] ?? settings.xpRules.problemEasy,
        eventType: 'problem_solved',
        description: `Solved: ${problemTitle}`,
        referenceId: problemId,
        referenceType: 'problem',
    }, session);
}

/** XP for passing a quiz. */
async function awardQuizXP(userId, quizId, quizTitle, session = null) {
    const settings = await PlatformSettings.getSettings();

    return awardXP(userId, {
        amount: settings.xpRules.quizPassed,
        eventType: 'quiz_passed',
        description: `Passed quiz: ${quizTitle}`,
        referenceId: quizId,
        referenceType: 'quiz',
    }, session);
}

/** Level, title and progress for a given XP total. */
async function getXPProgress(totalXP) {
    const settings = await PlatformSettings.getSettings();
    return settings.xpProgress(totalXP);
}

async function calculateLevel(totalXP) {
    const settings = await PlatformSettings.getSettings();
    return settings.levelForXP(totalXP);
}

async function getXPForLevel(level) {
    const settings = await PlatformSettings.getSettings();
    return settings.xpForLevel(level);
}

module.exports = {
    awardXP,
    awardLessonXP,
    awardCourseXP,
    awardStreakBonusXP,
    awardProblemXP,
    awardQuizXP,
    getXPProgress,
    calculateLevel,
    getXPForLevel,
    countTodaysAwards,
};
