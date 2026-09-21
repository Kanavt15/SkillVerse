/**
 * Scheduled gamification jobs.
 *
 * Changes from the MySQL version:
 *
 *   - `cleanupRefreshTokens` and `cleanupOldAuditLogs` are gone. TTL indexes on
 *     RefreshToken.expiresAt and ActivityAuditLog.createdAt do that work
 *     continuously, so there is nothing left to sweep.
 *
 *   - `weeklyLeaderboardSnapshot` is gone too: it selected the top 100 and then
 *     only console.log'd the count. It was a no-op dressed as a job.
 *
 *   - `checkStreaksAtRisk` had no LIMIT and issued one INSERT plus one socket
 *     emit per user. It is now batched and bounded.
 *
 *   - Schedules are pinned to a timezone. node-cron defaults to the process's
 *     local zone, so the comments claiming UTC were only true on a UTC server.
 */

const cron = require('node-cron');

const User = require('../models/User');
const DailyActivity = require('../models/DailyActivity');
const XpTransaction = require('../models/XpTransaction');
const { createNotification } = require('../controllers/notification.controller');
const { getUserActivityDate } = require('../services/streak.service');

const TZ = process.env.CRON_TIMEZONE || 'UTC';

/** Cap per run so one job cannot fan out unboundedly. */
const BATCH_LIMIT = 500;

/**
 * Warn users whose streak will lapse today.
 */
async function checkStreaksAtRisk() {
    try {
        const candidates = await User.find({
            'streak.current': { $gte: 3 },
            isSuspended: false,
        })
            .select('streak timezone')
            .limit(BATCH_LIMIT)
            .lean();

        const atRisk = [];

        for (const user of candidates) {
            const today = getUserActivityDate(user.timezone || 'UTC');
            // Last activity was yesterday and nothing logged today.
            const last = user.streak?.lastActivityDate;
            if (!last || last === today) continue;

            const gap = Math.round(
                (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86400000
            );
            if (gap === 1) atRisk.push({ user, today });
        }

        if (!atRisk.length) {
            console.log('[CRON] No streaks at risk.');
            return 0;
        }

        // Confirm none of them logged activity today.
        const active = await DailyActivity.find({
            user: { $in: atRisk.map((a) => a.user._id) },
            date: { $in: [...new Set(atRisk.map((a) => a.today))] },
        }).select('user date').lean();

        const activeKeys = new Set(active.map((a) => `${a.user}:${a.date}`));
        const needNotifying = atRisk.filter(
            (a) => !activeKeys.has(`${a.user._id}:${a.today}`)
        );

        if (!needNotifying.length) return 0;

        await createNotification.bulk(needNotifying.map(({ user }) => ({
            user: user._id,
            type: 'streak_at_risk',
            title: 'Your streak is at risk! 🔥',
            message: `You have a ${user.streak.current}-day streak. Complete a lesson today to keep it going`
                + `${user.streak.freezeCount > 0 ? `, or use one of your ${user.streak.freezeCount} streak freezes` : ''}.`,
            referenceType: 'streak',
        })));

        console.log(`[CRON] Notified ${needNotifying.length} users of at-risk streaks.`);
        return needNotifying.length;
    } catch (err) {
        console.error('[CRON] checkStreaksAtRisk failed:', err.message);
        return 0;
    }
}

/**
 * Prune very old activity rows. The audit log and refresh tokens handle
 * themselves via TTL indexes; these two have longer, product-defined lifetimes.
 */
async function dailyMaintenance() {
    try {
        const yearAgo = new Date(Date.now() - 365 * 86400_000);
        const twoYearsAgo = new Date(Date.now() - 730 * 86400_000);

        const [activity, xp] = await Promise.all([
            DailyActivity.deleteMany({ createdAt: { $lt: yearAgo } }),
            XpTransaction.deleteMany({ createdAt: { $lt: twoYearsAgo } }),
        ]);

        console.log(
            `[CRON] Maintenance: removed ${activity.deletedCount} activity rows, `
            + `${xp.deletedCount} XP rows.`
        );
        return { activity: activity.deletedCount, xp: xp.deletedCount };
    } catch (err) {
        console.error('[CRON] dailyMaintenance failed:', err.message);
        return null;
    }
}

/**
 * Nudge learners who have drifted away (last active 7-30 days ago).
 */
async function checkInactiveUsers() {
    try {
        const now = Date.now();
        const from = new Date(now - 30 * 86400_000);
        const to = new Date(now - 7 * 86400_000);

        const recent = await DailyActivity.aggregate([
            { $group: { _id: '$user', lastActive: { $max: '$createdAt' } } },
            { $match: { lastActive: { $gte: from, $lte: to } } },
            { $limit: 50 },
        ]);

        if (!recent.length) return 0;

        await createNotification.bulk(recent.map((r) => ({
            user: r._id,
            type: 'streak_at_risk',
            title: 'We miss you! 👋',
            message: 'Your courses are waiting. Pick up where you left off and rebuild your streak.',
            referenceType: 'streak',
        })));

        console.log(`[CRON] Re-engagement nudges sent to ${recent.length} users.`);
        return recent.length;
    } catch (err) {
        console.error('[CRON] checkInactiveUsers failed:', err.message);
        return 0;
    }
}

const jobs = [];

function initGamificationCronJobs() {
    console.log('[CRON] Initializing gamification cron jobs...');

    const opts = { timezone: TZ };

    jobs.push(cron.schedule('0 18 * * *', checkStreaksAtRisk, opts));
    jobs.push(cron.schedule('0 23 * * *', checkStreaksAtRisk, opts));
    jobs.push(cron.schedule('0 2 * * *', dailyMaintenance, opts));
    jobs.push(cron.schedule('0 10 */3 * *', checkInactiveUsers, opts));

    console.log('[CRON] Gamification cron jobs initialized successfully');
    console.log('[CRON] Scheduled tasks:');
    console.log(`  - Streak risk check: Daily at 6 PM and 11 PM ${TZ}`);
    console.log(`  - Daily maintenance: Daily at 2 AM ${TZ}`);
    console.log(`  - Re-engagement check: Every 3 days at 10 AM ${TZ}`);
    console.log('  - Token & audit cleanup: handled by TTL indexes');
}

function stopGamificationCronJobs() {
    jobs.forEach((j) => j.stop());
    jobs.length = 0;
}

module.exports = {
    initGamificationCronJobs,
    stopGamificationCronJobs,
    // Exposed for the admin panel and for tests.
    manualTriggers: {
        checkStreaksAtRisk,
        dailyMaintenance,
        checkInactiveUsers,
    },
};
