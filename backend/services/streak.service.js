/**
 * Daily streaks.
 *
 * TIMEZONE CORRECTNESS
 *
 * The MySQL version computed "today" in the user's zone like this:
 *
 *     const userTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
 *     return userTime.toISOString().split('T')[0];
 *
 * which is wrong on any server not running at UTC+0: `toLocaleString` produces
 * wall-clock text in the target zone, `new Date` reinterprets that text in the
 * SERVER's zone, and `toISOString` then converts back to UTC — re-applying the
 * server offset and shifting the date by a day near midnight. A learner on the
 * wrong side of that boundary silently loses their streak.
 *
 * `Intl.DateTimeFormat` with 'en-CA' yields YYYY-MM-DD directly in the target
 * zone with no Date round-trip, so there is no offset to re-apply.
 *
 * Dates are stored and compared as YYYY-MM-DD strings throughout, never as Date
 * objects, so the bug cannot be reintroduced downstream.
 */

const User = require('../models/User');
const DailyActivity = require('../models/DailyActivity');
const StreakFreeze = require('../models/StreakFreeze');
const PlatformSettings = require('../models/PlatformSettings');
const walletService = require('./wallet.service');

const STREAK_CONFIG = {
    // Activity before 4am counts toward the previous day — people studying
    // late should not need to cross midnight to keep a streak.
    GRACE_PERIOD_HOURS: 4,
    MILESTONES: [3, 7, 14, 30, 60, 100, 365],
};

/**
 * Today's date (YYYY-MM-DD) in the user's timezone, with the grace period
 * applied.
 */
function getUserActivityDate(timezone = 'UTC', now = new Date()) {
    let tz = timezone || 'UTC';
    let parts;

    try {
        parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
            hour12: false,
        }).formatToParts(now);
    } catch {
        // An invalid IANA name must not break lesson completion.
        tz = 'UTC';
        parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
            hour12: false,
        }).formatToParts(now);
    }

    const get = (type) => parts.find((p) => p.type === type).value;
    const year = Number(get('year'));
    const month = Number(get('month'));
    const day = Number(get('day'));
    // 'en-CA' renders midnight as 24 in some environments.
    const hour = Number(get('hour')) % 24;

    // Shift to the previous calendar day during the grace window. Done with
    // UTC arithmetic on a date-only value, so no timezone is involved.
    const asUTC = new Date(Date.UTC(year, month - 1, day));
    if (hour < STREAK_CONFIG.GRACE_PERIOD_HOURS) {
        asUTC.setUTCDate(asUTC.getUTCDate() - 1);
    }

    return asUTC.toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD strings. */
function daysBetween(fromDate, toDate) {
    if (!fromDate || !toDate) return null;
    const a = Date.parse(`${fromDate}T00:00:00Z`);
    const b = Date.parse(`${toDate}T00:00:00Z`);
    return Math.round((b - a) / 86400000);
}

/**
 * Register activity for today and advance, hold or break the streak.
 *
 * @returns {{currentStreak, longestStreak, streakExtended, streakBroken,
 *            freezeUsed, isFirstActivityToday, streakMilestone, activityDate}}
 */
async function updateStreakOnActivity(userId, session = null, now = new Date()) {
    const user = await User.findById(userId).select('streak timezone').session(session);
    if (!user) throw new Error('User not found');

    const today = getUserActivityDate(user.timezone, now);
    const last = user.streak.lastActivityDate;
    const gap = daysBetween(last, today);

    let currentStreak = user.streak.current || 0;
    let freezeUsed = false;
    let streakBroken = false;
    let streakExtended = false;

    if (!last) {
        currentStreak = 1;
        streakExtended = true;
    } else if (gap === 0) {
        // Already active today — the streak neither grows nor resets. This is
        // what stops repeated activity inflating a streak.
        streakExtended = false;
    } else if (gap === 1) {
        currentStreak += 1;
        streakExtended = true;
    } else if (gap === 2 && (user.streak.freezeCount || 0) > 0) {
        // One freeze bridges exactly a one-day gap.
        currentStreak += 1;
        streakExtended = true;
        freezeUsed = true;
    } else if (gap > 1) {
        currentStreak = 1;
        streakBroken = true;
    } else {
        // gap < 0: clock skew or a timezone change moving the user backwards.
        // Treat as same-day rather than punishing them for it.
        streakExtended = false;
    }

    const longestStreak = Math.max(user.streak.longest || 0, currentStreak);
    const isFirstActivityToday = gap !== 0;

    const update = {
        $set: {
            'streak.current': currentStreak,
            'streak.longest': longestStreak,
            'streak.lastActivityDate': today,
        },
    };
    if (freezeUsed) {
        update.$inc = { 'streak.freezeCount': -1 };
    }
    await User.updateOne({ _id: userId }, update, { session });

    if (freezeUsed) {
        await StreakFreeze.create([{
            user: userId,
            freezeDate: today,
            reason: 'consumed',
        }], { session });
    }

    // Upsert today's activity row. Replaces the INSERT ... then UPDATE pair
    // that relied on the unique (user, date) key.
    await DailyActivity.updateOne(
        { user: userId, date: today },
        {
            $inc: { lessonsCompleted: 0 },
            $set: { streakMaintained: true },
            $setOnInsert: { user: userId, date: today },
        },
        { upsert: true, session }
    );

    const streakMilestone = streakExtended && STREAK_CONFIG.MILESTONES.includes(currentStreak)
        ? currentStreak
        : null;

    return {
        currentStreak,
        longestStreak,
        streakExtended,
        streakBroken,
        freezeUsed,
        isFirstActivityToday,
        streakMilestone,
        activityDate: today,
    };
}

/**
 * Record XP and counters against today's activity row.
 *
 * The MySQL version hardcoded UTC here while `updateStreakOnActivity` used the
 * user's zone, so on a mismatch this updated a row that did not exist and the
 * XP silently vanished from the heatmap. Both now use the same date.
 */
async function updateDailyXP(userId, xpAmount, session = null, extra = {}) {
    if (!xpAmount && !Object.keys(extra).length) return;

    const user = await User.findById(userId).select('timezone').session(session);
    if (!user) return;

    const today = getUserActivityDate(user.timezone);

    const inc = { xpEarned: xpAmount || 0 };
    if (extra.lessonsCompleted) inc.lessonsCompleted = extra.lessonsCompleted;
    if (extra.problemsSolved) inc.problemsSolved = extra.problemsSolved;
    if (extra.quizzesCompleted) inc.quizzesCompleted = extra.quizzesCompleted;
    if (extra.timeSpentMinutes) inc.timeSpentMinutes = extra.timeSpentMinutes;

    await DailyActivity.updateOne(
        { user: userId, date: today },
        { $inc: inc, $setOnInsert: { user: userId, date: today } },
        { upsert: true, session }
    );
}

/** Streak state for the dashboard, including the at-risk warning. */
async function getStreakInfo(userId) {
    const user = await User.findById(userId).select('streak timezone').lean();
    if (!user) return null;

    const today = getUserActivityDate(user.timezone);
    const last = user.streak?.lastActivityDate || null;
    const gap = daysBetween(last, today);

    const hasActivityToday = gap === 0;
    const current = user.streak?.current || 0;

    // Last 7 days of activity for the heatmap.
    const dates = [];
    for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(`${today}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - i);
        dates.push(d.toISOString().slice(0, 10));
    }

    const activity = await DailyActivity.find({
        user: userId,
        date: { $in: dates },
    }).lean();

    const nextMilestone = STREAK_CONFIG.MILESTONES.find((m) => m > current) || null;

    return {
        currentStreak: current,
        longestStreak: user.streak?.longest || 0,
        lastActivityDate: last,
        freezeCount: user.streak?.freezeCount || 0,
        hasActivityToday,
        // Active streak, nothing done today, and yesterday was the last day.
        isAtRisk: current > 0 && !hasActivityToday && gap === 1,
        nextMilestone,
        recentActivity: dates.map((date) => {
            const found = activity.find((a) => a.date === date);
            return {
                activity_date: date,
                lessons_completed: found?.lessonsCompleted || 0,
                xp_earned: found?.xpEarned || 0,
            };
        }),
    };
}

/** Buy a streak freeze with wallet credits. */
async function purchaseStreakFreeze(userId, session = null) {
    const settings = await PlatformSettings.getSettings();
    const cost = settings.streakFreezeCost;

    // The wallet service rejects an overdraft atomically, so there is no
    // check-then-spend window.
    const { balance } = await walletService.debit(userId, {
        amount: cost,
        source: 'streak_freeze',
        description: 'Streak freeze',
    }, session);

    await User.updateOne(
        { _id: userId },
        { $inc: { 'streak.freezeCount': 1 } },
        { session }
    );

    await StreakFreeze.create([{
        user: userId,
        freezeDate: getUserActivityDate('UTC'),
        reason: 'purchased',
    }], { session });

    return { success: true, cost, newBalance: balance };
}

module.exports = {
    STREAK_CONFIG,
    getUserActivityDate,
    daysBetween,
    updateStreakOnActivity,
    updateDailyXP,
    getStreakInfo,
    purchaseStreakFreeze,
};
