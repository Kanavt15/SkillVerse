/**
 * Gamification endpoints: XP, levels, streaks, badges, leaderboards.
 *
 * The leaderboard rank was `COUNT(*) + 1` with a correlated subquery — a
 * hand-rolled RANK(). Since `xp` is denormalized on the user and indexed
 * descending, rank is now `countDocuments({ xp: { $gt: mine } }) + 1`, which
 * uses that index directly.
 */

const User = require('../models/User');
const XpTransaction = require('../models/XpTransaction');
const DailyActivity = require('../models/DailyActivity');
const PlatformSettings = require('../models/PlatformSettings');
const serialize = require('../serializers');
const {
    getStreakInfo, purchaseStreakFreeze, getUserActivityDate,
} = require('../services/streak.service');
const {
    getUserBadges, getAllBadges, toggleFeaturedBadge,
} = require('../services/badge.service');
const teachingService = require('../services/teaching.service');
const walletService = require('../services/wallet.service');

// ------------------------------------------------------------------
// GET /api/gamification/stats
// ------------------------------------------------------------------
const getGamificationStats = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
            .select('xp level learningStats streak teaching wallet')
            .lean();

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const settings = await PlatformSettings.getSettings();
        const xpProgress = settings.xpProgress(user.xp || 0);

        const rank = (await User.countDocuments({ xp: { $gt: user.xp || 0 } })) + 1;

        return res.json({
            success: true,
            xp: user.xp || 0,
            level: user.level || 1,
            xpProgress,
            rank,
            stats: {
                courses_completed: user.learningStats?.coursesCompleted || 0,
                lessons_completed: user.learningStats?.lessonsCompleted || 0,
                problems_solved: user.learningStats?.problemsSolved || 0,
                quizzes_completed: user.learningStats?.quizzesCompleted || 0,
                average_quiz_score: user.learningStats?.averageQuizScore || 0,
                learning_minutes: user.learningStats?.learningMinutes || 0,
                certificates_earned: user.learningStats?.certificatesEarned || 0,
            },
            teaching: {
                isEligible: user.teaching?.isEligible || false,
                unlockedAt: user.teaching?.unlockedAt || null,
            },
            points: user.wallet?.balance || 0,
        });
    } catch (error) {
        console.error('Get gamification stats error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/gamification/xp/history
// ------------------------------------------------------------------
const getXPHistory = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

        const filter = { user: req.user.id };

        const [transactions, total] = await Promise.all([
            XpTransaction.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            XpTransaction.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            transactions: transactions.map((t) => ({
                id: String(t._id),
                amount: t.amount,
                event_type: t.eventType,
                description: t.description,
                reference_id: t.referenceId ? String(t.referenceId) : null,
                reference_type: t.referenceType,
                created_at: t.createdAt,
            })),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                limit,
            },
        });
    } catch (error) {
        console.error('Get XP history error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/gamification/streak
// ------------------------------------------------------------------
const getStreakDetails = async (req, res, next) => {
    try {
        const info = await getStreakInfo(req.user.id);
        if (!info) return res.status(404).json({ success: false, message: 'User not found' });
        return res.json({ success: true, ...info });
    } catch (error) {
        console.error('Get streak details error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// POST /api/gamification/streak/freeze
// ------------------------------------------------------------------
const buyStreakFreeze = async (req, res, next) => {
    try {
        const result = await purchaseStreakFreeze(req.user.id);
        return res.json({ success: true, message: 'Streak freeze purchased', ...result });
    } catch (error) {
        if (error instanceof walletService.InsufficientBalanceError) {
            return res.status(400).json({
                success: false,
                message: `Not enough points. You need ${error.required} but only have ${error.available}.`,
                required: error.required,
                available: error.available,
            });
        }
        console.error('Buy streak freeze error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/gamification/badges
// ------------------------------------------------------------------
const getBadges = async (req, res, next) => {
    try {
        const badges = await getUserBadges(req.user.id);
        return res.json({ success: true, count: badges.length, badges });
    } catch (error) {
        console.error('Get badges error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/gamification/badges/all
// ------------------------------------------------------------------
const getAllAvailableBadges = async (req, res, next) => {
    try {
        const badges = await getAllBadges(req.user.id);
        return res.json({
            success: true,
            count: badges.length,
            badges,
            earned: badges.filter((b) => b.earned).length,
        });
    } catch (error) {
        console.error('Get all badges error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/gamification/badges/:badgeId/feature
// ------------------------------------------------------------------
const featureBadge = async (req, res, next) => {
    try {
        const result = await toggleFeaturedBadge(req.user.id, req.params.badgeId);
        if (!result.success) return res.status(404).json(result);
        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('Feature badge error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/gamification/leaderboard
// ------------------------------------------------------------------
const getLeaderboard = async (req, res, next) => {
    try {
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const period = req.query.period || 'all';

        let entries;
        let total;

        if (period === 'all') {
            // Indexed sort on the denormalized xp field.
            [entries, total] = await Promise.all([
                User.find({ isSuspended: false })
                    .select('fullName username profileImage xp level teaching createdAt')
                    .sort({ xp: -1, createdAt: 1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean(),
                User.countDocuments({ isSuspended: false }),
            ]);
            entries = entries.map((u, i) => ({
                rank: (page - 1) * limit + i + 1,
                ...serialize.publicUser(u),
                xp: u.xp || 0,
                level: u.level || 1,
            }));
        } else {
            // Weekly/monthly ranks by XP EARNED in the window, which only the
            // ledger knows — the user document holds a lifetime total.
            const since = new Date();
            if (period === 'weekly') since.setDate(since.getDate() - 7);
            else since.setMonth(since.getMonth() - 1);

            const agg = await XpTransaction.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: '$user', periodXP: { $sum: '$amount' } } },
                { $sort: { periodXP: -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'users', localField: '_id', foreignField: '_id', as: 'user',
                    },
                },
                { $unwind: '$user' },
                { $match: { 'user.isSuspended': false } },
            ]);

            entries = agg.map((row, i) => ({
                rank: (page - 1) * limit + i + 1,
                ...serialize.publicUser(row.user),
                xp: row.periodXP,
                level: row.user.level || 1,
            }));

            const distinct = await XpTransaction.distinct('user', { createdAt: { $gte: since } });
            total = distinct.length;
        }

        // Where the requester sits, even if off this page.
        const me = await User.findById(req.user.id).select('xp').lean();
        const myRank = me ? (await User.countDocuments({ xp: { $gt: me.xp || 0 } })) + 1 : null;

        return res.json({
            success: true,
            period,
            leaderboard: entries,
            myRank,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                limit,
            },
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/gamification/activity
// ------------------------------------------------------------------
const getActivityHistory = async (req, res, next) => {
    try {
        const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));

        const user = await User.findById(req.user.id).select('timezone').lean();
        const today = getUserActivityDate(user?.timezone || 'UTC');

        const dates = [];
        for (let i = days - 1; i >= 0; i -= 1) {
            const d = new Date(`${today}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() - i);
            dates.push(d.toISOString().slice(0, 10));
        }

        const activity = await DailyActivity.find({
            user: req.user.id,
            date: { $in: dates },
        }).lean();
        const byDate = new Map(activity.map((a) => [a.date, a]));

        return res.json({
            success: true,
            activity: dates.map((date) => {
                const a = byDate.get(date);
                return {
                    activity_date: date,
                    lessons_completed: a?.lessonsCompleted || 0,
                    problems_solved: a?.problemsSolved || 0,
                    xp_earned: a?.xpEarned || 0,
                    time_spent_minutes: a?.timeSpentMinutes || 0,
                };
            }),
        });
    } catch (error) {
        console.error('Get activity history error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// PUT /api/gamification/timezone
// ------------------------------------------------------------------
const updateTimezone = async (req, res, next) => {
    try {
        const { timezone } = req.body;

        // Validate against the runtime's own IANA database rather than a list
        // that would go stale.
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
        } catch {
            return res.status(400).json({ success: false, message: 'Invalid timezone' });
        }

        await User.updateOne({ _id: req.user.id }, { $set: { timezone } });
        return res.json({ success: true, message: 'Timezone updated', timezone });
    } catch (error) {
        console.error('Update timezone error:', error);
        return next(error);
    }
};

// ------------------------------------------------------------------
// GET /api/gamification/teaching  (spec §6)
// ------------------------------------------------------------------
const getTeachingStatus = async (req, res, next) => {
    try {
        const status = await teachingService.getStatus(req.user.id);
        if (!status) return res.status(404).json({ success: false, message: 'User not found' });
        return res.json({ success: true, teaching: status });
    } catch (error) {
        console.error('Get teaching status error:', error);
        return next(error);
    }
};

module.exports = {
    getGamificationStats,
    getXPHistory,
    getStreakDetails,
    buyStreakFreeze,
    getBadges,
    getAllAvailableBadges,
    featureBadge,
    getLeaderboard,
    getActivityHistory,
    updateTimezone,
    getTeachingStatus,
};
