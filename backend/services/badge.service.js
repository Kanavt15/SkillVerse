/**
 * Achievement (badge) evaluation.
 *
 * The MySQL version built the user's stats with one query containing NINE
 * correlated subqueries across seven tables, re-derived on every single lesson
 * completion. Those aggregates now live on the user document
 * (`learningStats`, `xp`, `level`, `streak`), maintained incrementally at the
 * point each event happens, so evaluation is a read of one document.
 *
 * Only `categories_explored` still needs a query, because it depends on the
 * distinct set of categories a learner has finished courses in and cannot be
 * kept as a simple counter.
 */

const mongoose = require('mongoose');
const Achievement = require('../models/Achievement');
const UserAchievement = require('../models/UserAchievement');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const { awardXP } = require('./xp.service');

const toObjectId = (v) => new mongoose.Types.ObjectId(String(v));

/**
 * Gather everything the criteria evaluator can test against.
 */
async function getUserStats(userId, session = null) {
    const user = await User.findById(userId)
        .select('xp level streak learningStats teaching')
        .session(session)
        .lean();

    if (!user) return null;

    const s = user.learningStats || {};

    return {
        totalXP: user.xp || 0,
        level: user.level || 1,
        currentStreak: user.streak?.current || 0,
        longestStreak: user.streak?.longest || 0,
        coursesCompleted: s.coursesCompleted || 0,
        lessonsCompleted: s.lessonsCompleted || 0,
        problemsSolved: s.problemsSolved || 0,
        quizzesCompleted: s.quizzesCompleted || 0,
        reviewsPosted: s.reviewsPosted || 0,
        discussionsPosted: s.discussionsPosted || 0,
        helpfulAnswers: s.helpfulAnswers || 0,
        certificatesEarned: s.certificatesEarned || 0,
        totalTimeSpentMinutes: s.learningMinutes || 0,
        teachingUnlocked: user.teaching?.isEligible ? 1 : 0,
    };
}

/**
 * Distinct categories the learner has completed at least one course in.
 * Computed lazily — only when a `categories_explored` badge is still unearned.
 */
async function countCategoriesExplored(userId, session = null) {
    const result = await Enrollment.aggregate([
        { $match: { user: toObjectId(userId), completedAt: { $ne: null } } },
        {
            $lookup: {
                from: 'courses', localField: 'course', foreignField: '_id', as: 'course',
            },
        },
        { $unwind: '$course' },
        { $match: { 'course.category': { $ne: null } } },
        { $group: { _id: '$course.category' } },
        { $count: 'total' },
    ]).session(session);

    return result[0]?.total || 0;
}

/**
 * Does this achievement's criterion hold for these stats?
 */
function checkCriteria(achievement, stats, metadata = {}) {
    const { criteriaType, criteriaValue } = achievement;

    switch (criteriaType) {
        case 'streak_days': return stats.longestStreak >= criteriaValue;
        case 'courses_completed': return stats.coursesCompleted >= criteriaValue;
        case 'lessons_completed': return stats.lessonsCompleted >= criteriaValue;
        case 'problems_solved': return stats.problemsSolved >= criteriaValue;
        case 'quizzes_completed': return stats.quizzesCompleted >= criteriaValue;
        case 'total_xp': return stats.totalXP >= criteriaValue;
        case 'level_reached': return stats.level >= criteriaValue;
        case 'time_spent_hours': return stats.totalTimeSpentMinutes >= criteriaValue * 60;
        case 'reviews_posted': return stats.reviewsPosted >= criteriaValue;
        case 'discussions_posted': return stats.discussionsPosted >= criteriaValue;
        case 'helpful_answers': return stats.helpfulAnswers >= criteriaValue;
        case 'certificates_earned': return stats.certificatesEarned >= criteriaValue;
        case 'challenges_completed': return (stats.challengesCompleted || 0) >= criteriaValue;
        case 'teaching_unlocked': return stats.teachingUnlocked === 1;
        case 'categories_explored': return (stats.categoriesExplored || 0) >= criteriaValue;

        // Time-of-day badges depend on when the action happened, which only the
        // caller knows.
        case 'early_bird': return metadata.hour !== undefined && metadata.hour < 8;
        case 'night_owl': return metadata.hour !== undefined && metadata.hour >= 22;

        // Not yet tracked; the caller never supplies these.
        case 'weekend_warrior': return Boolean(metadata.consecutiveWeekends);
        case 'perfect_course': return Boolean(metadata.perfectCourse);

        default: return false;
    }
}

/**
 * Award every achievement the user now qualifies for.
 *
 * Idempotent: the unique (user, achievement) index means a concurrent
 * evaluation cannot double-award, and a duplicate-key error is treated as
 * "already earned" rather than a failure.
 *
 * @returns {Array} the achievements newly earned in this call
 */
async function checkAndAwardBadges(userId, metadata = {}, session = null) {
    const stats = await getUserStats(userId, session);
    if (!stats) return [];

    // Achievements this user has not earned yet.
    const earned = await UserAchievement.find({ user: userId })
        .select('achievement')
        .session(session)
        .lean();
    const earnedIds = earned.map((e) => e.achievement);

    const candidates = await Achievement.find({
        isActive: true,
        _id: { $nin: earnedIds },
    }).session(session).lean();

    if (!candidates.length) return [];

    // Only pay for the category aggregation if something actually needs it.
    if (candidates.some((a) => a.criteriaType === 'categories_explored')) {
        stats.categoriesExplored = await countCategoriesExplored(userId, session);
    }

    const newlyEarned = [];

    for (const achievement of candidates) {
        if (!checkCriteria(achievement, stats, metadata)) continue;

        try {
            /* eslint-disable no-await-in-loop */
            await UserAchievement.create([{
                user: userId,
                achievement: achievement._id,
            }], { session });

            if (achievement.xpReward > 0) {
                await awardXP(userId, {
                    amount: achievement.xpReward,
                    eventType: 'badge_earned',
                    description: `Achievement unlocked: ${achievement.name}`,
                    referenceId: achievement._id,
                    referenceType: 'badge',
                }, session);
            }
            /* eslint-enable no-await-in-loop */

            newlyEarned.push(achievement);
        } catch (err) {
            // 11000 = someone else awarded it first. Not an error.
            if (err.code !== 11000) throw err;
        }
    }

    return newlyEarned;
}

/** A user's earned achievements, newest first. */
async function getUserBadges(userId) {
    const earned = await UserAchievement.find({ user: userId })
        .sort({ earnedAt: -1 })
        .populate('achievement')
        .lean();

    return earned
        .filter((e) => e.achievement)
        .map((e) => ({
            id: String(e.achievement._id),
            slug: e.achievement.slug,
            name: e.achievement.name,
            description: e.achievement.description,
            icon: e.achievement.icon,
            category: e.achievement.category,
            tier: e.achievement.tier,
            xp_reward: e.achievement.xpReward,
            xpReward: e.achievement.xpReward,
            earned_at: e.earnedAt,
            is_featured: e.isFeatured,
        }));
}

/** Every achievement, flagged with whether this user has it. */
async function getAllBadges(userId = null) {
    const all = await Achievement.find({ isActive: true }).sort({ category: 1, tier: 1 }).lean();

    let earnedIds = new Set();
    if (userId) {
        const earned = await UserAchievement.find({ user: userId }).select('achievement').lean();
        earnedIds = new Set(earned.map((e) => String(e.achievement)));
    }

    return all.map((a) => ({
        id: String(a._id),
        slug: a.slug,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        tier: a.tier,
        xp_reward: a.xpReward,
        criteria_type: a.criteriaType,
        criteria_value: a.criteriaValue,
        earned: earnedIds.has(String(a._id)),
    }));
}

/**
 * Feature one badge on the profile, clearing any previous choice.
 * At most one may be featured, which the two writes below enforce together.
 */
async function toggleFeaturedBadge(userId, achievementId, session = null) {
    const target = await UserAchievement.findOne({
        user: userId,
        achievement: achievementId,
    }).session(session);

    if (!target) return { success: false, message: 'Achievement not earned' };

    const makeFeatured = !target.isFeatured;

    if (makeFeatured) {
        await UserAchievement.updateMany(
            { user: userId },
            { $set: { isFeatured: false } },
            { session }
        );
    }

    target.isFeatured = makeFeatured;
    await target.save({ session });

    return { success: true, isFeatured: makeFeatured };
}

module.exports = {
    getUserStats,
    checkCriteria,
    checkAndAwardBadges,
    getUserBadges,
    getAllBadges,
    toggleFeaturedBadge,
    countCategoriesExplored,
};
