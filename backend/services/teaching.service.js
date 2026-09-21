/**
 * Teaching eligibility.
 *
 * The product's central idea: teaching is EARNED by demonstrating learning
 * progress, not chosen at signup. Requirements are admin-configurable
 * (PlatformSettings.teachingRequirements), so eligibility is always recomputed
 * from current settings rather than trusted from a cached flag or a JWT claim.
 *
 * `User.teaching.isEligible` is a cache used to decide when to fire the
 * unlock celebration; `evaluate()` is the authority.
 */

const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const Achievement = require('../models/Achievement');
const { createNotification } = require('../controllers/notification.controller');

/** Slug of the achievement granted on unlock. */
const MENTOR_ACHIEVEMENT_SLUG = 'knowledge-mentor';

/**
 * Compare a user against the current requirements.
 *
 * Returns the full per-criterion breakdown, because the UI shows progress
 * toward each one ("Level 7 / 10") rather than a bare locked/unlocked flag.
 *
 * @returns {{eligible, requirements: Array, progress: object}}
 */
async function evaluate(user) {
    const settings = await PlatformSettings.getSettings();
    const req = settings.teachingRequirements;
    const stats = user.learningStats || {};

    // An admin can switch the whole gate off.
    if (!req.enabled) {
        return { eligible: true, requirements: [], disabled: true };
    }

    const criteria = [
        {
            key: 'level',
            label: 'Level',
            current: user.level || 0,
            required: req.requiredLevel,
        },
        {
            key: 'xp',
            label: 'XP',
            current: user.xp || 0,
            required: req.requiredXP,
        },
        {
            key: 'coursesCompleted',
            label: 'Courses completed',
            current: stats.coursesCompleted || 0,
            required: req.requiredCoursesCompleted,
        },
        {
            key: 'problemsSolved',
            label: 'Problems solved',
            current: stats.problemsSolved || 0,
            required: req.requiredProblemsSolved,
        },
        {
            key: 'quizAverage',
            label: 'Quiz average',
            current: Math.round(stats.averageQuizScore || 0),
            required: req.requiredQuizAverage,
            unit: '%',
        },
    ];

    const requirements = criteria.map((c) => ({
        ...c,
        met: c.current >= c.required,
    }));

    return {
        eligible: requirements.every((r) => r.met),
        requirements,
        unlockMode: req.unlockMode,
    };
}

/**
 * Re-evaluate and, on a first pass, unlock teaching.
 *
 * Called after anything that can move the underlying numbers: lesson
 * completion, course completion, an accepted submission, a quiz attempt.
 *
 * The unlock write is conditional on `teaching.isEligible: false`, so two
 * concurrent evaluations cannot both decide they were the one that unlocked it
 * and fire two celebrations.
 *
 * @returns {{eligible, justUnlocked, requirements}}
 */
async function evaluateAndUnlock(userId, session = null) {
    const user = await User.findById(userId)
        .select('xp level learningStats teaching')
        .session(session);

    if (!user) return { eligible: false, justUnlocked: false, requirements: [] };

    const result = await evaluate(user);

    if (!result.eligible || user.teaching?.isEligible) {
        return { ...result, justUnlocked: false };
    }

    const updated = await User.findOneAndUpdate(
        { _id: userId, 'teaching.isEligible': false },
        { $set: { 'teaching.isEligible': true, 'teaching.unlockedAt': new Date() } },
        { new: true, session }
    );

    // Someone else won the race; they own the celebration.
    if (!updated) return { ...result, justUnlocked: false };

    return { ...result, justUnlocked: true };
}

/**
 * Side effects of unlocking: the Knowledge Mentor achievement and a
 * notification. Run AFTER the triggering transaction commits — a notification
 * failure must never roll back the learning that earned it.
 */
async function announceUnlock(userId) {
    try {
        const achievement = await Achievement.findOne({ slug: MENTOR_ACHIEVEMENT_SLUG }).lean();

        if (achievement) {
            const UserAchievement = require('../models/UserAchievement');
            try {
                await UserAchievement.create({ user: userId, achievement: achievement._id });
            } catch (err) {
                // Already held — the unique index did its job.
                if (err.code !== 11000) throw err;
            }
        }

        await createNotification(
            userId,
            'teaching_unlocked',
            'Teaching Unlocked!',
            'You have reached the required learning milestone. You can now create courses, '
            + 'coding problems, quizzes and learning resources for other learners.',
            null,
            'teaching'
        );
    } catch (err) {
        console.error('Teaching unlock announcement error:', err.message);
    }
}

/**
 * The payload behind the "Teaching" panel — locked or unlocked, with progress
 * toward every unmet requirement.
 */
async function getStatus(userId) {
    const user = await User.findById(userId)
        .select('xp level learningStats teaching')
        .lean();

    if (!user) return null;

    const result = await evaluate(user);

    return {
        isUnlocked: user.teaching?.isEligible === true,
        unlockedAt: user.teaching?.unlockedAt || null,
        // Meeting the bar right now, whether or not the flag has caught up.
        meetsRequirements: result.eligible,
        requirements: result.requirements,
        coursesCreated: user.teaching?.coursesCreated || 0,
        coursesPublished: user.teaching?.coursesPublished || 0,
        unlockMode: result.unlockMode,
    };
}

module.exports = {
    evaluate,
    evaluateAndUnlock,
    announceUnlock,
    getStatus,
    MENTOR_ACHIEVEMENT_SLUG,
};
