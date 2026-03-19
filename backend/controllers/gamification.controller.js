const { pool } = require('../config/database');
const { getXPProgress } = require('../services/xp.service');
const { getStreakInfo, purchaseStreakFreeze } = require('../services/streak.service');
const { getUserBadges, getAllBadges, toggleFeaturedBadge, getBadgeStats } = require('../services/badge.service');

/**
 * GET /api/gamification/stats
 * Returns comprehensive gamification stats for the user
 */
const getGamificationStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await pool.query(
      `SELECT xp, level, current_streak, longest_streak,
              streak_last_activity_date, streak_freeze_count, timezone
       FROM users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];
    const xpProgress = getXPProgress(user.xp);

    // Get badge count
    const [[badgeCount]] = await pool.query(
      'SELECT COUNT(*) as count FROM user_badges WHERE user_id = ?',
      [userId]
    );

    // Get today's activity
    const today = new Date().toISOString().split('T')[0];
    const [todayActivity] = await pool.query(
      'SELECT * FROM daily_activity_log WHERE user_id = ? AND activity_date = ?',
      [userId, today]
    );

    // Get featured badge
    const [featuredBadge] = await pool.query(
      `SELECT bd.* FROM badge_definitions bd
       JOIN user_badges ub ON bd.id = ub.badge_id
       WHERE ub.user_id = ? AND ub.is_featured = TRUE`,
      [userId]
    );

    res.json({
      success: true,
      stats: {
        xp: {
          total: user.xp,
          level: xpProgress.level,
          currentLevelXP: xpProgress.xpInCurrentLevel,
          xpToNextLevel: xpProgress.xpNeededForNext,
          progressPercentage: xpProgress.progressPercentage
        },
        streak: {
          current: user.current_streak,
          longest: user.longest_streak,
          lastActivityDate: user.streak_last_activity_date,
          freezesAvailable: user.streak_freeze_count,
          maintainedToday: todayActivity.length > 0
        },
        badges: {
          earned: badgeCount.count,
          featured: featuredBadge[0] || null
        },
        todayActivity: todayActivity[0] || null
      }
    });
  } catch (error) {
    console.error('Get gamification stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
};

/**
 * GET /api/gamification/xp/history
 * Returns paginated XP transaction history
 */
const getXPHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const [transactions] = await pool.query(
      `SELECT * FROM xp_transactions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [[total]] = await pool.query(
      'SELECT COUNT(*) as count FROM xp_transactions WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total: total.count,
        totalPages: Math.ceil(total.count / limit)
      }
    });
  } catch (error) {
    console.error('Get XP history error:', error);
    res.status(500).json({ success: false, message: 'Error fetching XP history' });
  }
};

/**
 * GET /api/gamification/streak
 * Returns detailed streak information
 */
const getStreakDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const streakInfo = await getStreakInfo(userId);

    res.json({
      success: true,
      streak: streakInfo
    });
  } catch (error) {
    console.error('Get streak details error:', error);
    res.status(500).json({ success: false, message: 'Error fetching streak info' });
  }
};

/**
 * POST /api/gamification/streak/freeze
 * Purchase a streak freeze
 */
const buyStreakFreeze = async (req, res) => {
  try {
    const userId = req.user.id;
    const pointsCost = 100; // Could be configurable

    const result = await purchaseStreakFreeze(userId, pointsCost);

    res.json({
      success: true,
      message: `Streak freeze purchased for ${pointsCost} points`,
      ...result
    });
  } catch (error) {
    console.error('Purchase streak freeze error:', error);
    if (error.message === 'Insufficient points') {
      return res.status(400).json({ success: false, message: 'Not enough points to purchase streak freeze' });
    }
    res.status(500).json({ success: false, message: 'Error purchasing streak freeze' });
  }
};

/**
 * GET /api/gamification/badges
 * Returns user's earned badges
 */
const getBadges = async (req, res) => {
  try {
    const userId = req.user.id;
    const badges = await getUserBadges(userId);
    const stats = await getBadgeStats(userId);

    res.json({
      success: true,
      badges,
      stats
    });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ success: false, message: 'Error fetching badges' });
  }
};

/**
 * GET /api/gamification/badges/all
 * Returns all available badges with earned status
 */
const getAllAvailableBadges = async (req, res) => {
  try {
    const userId = req.user.id;
    const badges = await getAllBadges(userId);

    // Group by category
    const grouped = badges.reduce((acc, badge) => {
      if (!acc[badge.category]) {
        acc[badge.category] = [];
      }
      acc[badge.category].push(badge);
      return acc;
    }, {});

    res.json({
      success: true,
      badges: grouped,
      total: badges.length,
      earned: badges.filter(b => b.earned).length
    });
  } catch (error) {
    console.error('Get all badges error:', error);
    res.status(500).json({ success: false, message: 'Error fetching badges' });
  }
};

/**
 * PUT /api/gamification/badges/:badgeId/feature
 * Toggle featured status for a badge
 */
const featureBadge = async (req, res) => {
  try {
    const userId = req.user.id;
    const badgeId = parseInt(req.params.badgeId);

    const isFeatured = await toggleFeaturedBadge(userId, badgeId);

    res.json({
      success: true,
      message: isFeatured ? 'Badge is now featured' : 'Badge unfeatured',
      isFeatured
    });
  } catch (error) {
    console.error('Feature badge error:', error);
    if (error.message === 'Badge not earned') {
      return res.status(400).json({ success: false, message: 'You have not earned this badge' });
    }
    res.status(500).json({ success: false, message: 'Error updating badge' });
  }
};

/**
 * GET /api/gamification/leaderboard
 * Returns leaderboard by XP, streak, or level
 */
const getLeaderboard = async (req, res) => {
  try {
    const type = req.query.type || 'xp'; // xp, streak, level
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const userId = req.user.id;

    let orderBy;
    switch (type) {
      case 'streak':
        orderBy = 'current_streak DESC, longest_streak DESC';
        break;
      case 'level':
        orderBy = 'level DESC, xp DESC';
        break;
      default:
        orderBy = 'xp DESC';
    }

    const [leaderboard] = await pool.query(
      `SELECT id, full_name, profile_image, xp, level, current_streak
       FROM users
       WHERE role = 'learner'
       ORDER BY ${orderBy}
       LIMIT ?`,
      [limit]
    );

    // Find current user's rank
    let userRankQuery;
    switch (type) {
      case 'streak':
        userRankQuery = 'SELECT COUNT(*) + 1 as rank FROM users WHERE role = \'learner\' AND current_streak > (SELECT current_streak FROM users WHERE id = ?)';
        break;
      case 'level':
        userRankQuery = 'SELECT COUNT(*) + 1 as rank FROM users WHERE role = \'learner\' AND (level > (SELECT level FROM users WHERE id = ?) OR (level = (SELECT level FROM users WHERE id = ?) AND xp > (SELECT xp FROM users WHERE id = ?)))';
        break;
      default:
        userRankQuery = 'SELECT COUNT(*) + 1 as rank FROM users WHERE role = \'learner\' AND xp > (SELECT xp FROM users WHERE id = ?)';
    }

    const rankParams = type === 'level' ? [userId, userId, userId] : [userId];
    const [[userRank]] = await pool.query(userRankQuery, rankParams);

    res.json({
      success: true,
      type,
      leaderboard: leaderboard.map((u, idx) => ({
        rank: idx + 1,
        id: u.id,
        name: u.full_name,
        avatar: u.profile_image,
        xp: u.xp,
        level: u.level,
        streak: u.current_streak,
        isCurrentUser: u.id === userId
      })),
      currentUserRank: userRank.rank
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Error fetching leaderboard' });
  }
};

/**
 * PUT /api/gamification/timezone
 * Update user's timezone
 */
const updateTimezone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timezone } = req.body;

    if (!timezone) {
      return res.status(400).json({ success: false, message: 'Timezone is required' });
    }

    // Validate timezone
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid timezone' });
    }

    await pool.query(
      'UPDATE users SET timezone = ? WHERE id = ?',
      [timezone, userId]
    );

    res.json({
      success: true,
      message: 'Timezone updated',
      timezone
    });
  } catch (error) {
    console.error('Update timezone error:', error);
    res.status(500).json({ success: false, message: 'Error updating timezone' });
  }
};

/**
 * GET /api/gamification/activity
 * Returns daily activity history
 */
const getActivityHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const days = Math.min(parseInt(req.query.days) || 30, 365);

    const [activity] = await pool.query(
      `SELECT activity_date, lessons_completed, time_spent_minutes, xp_earned, streak_maintained
       FROM daily_activity_log
       WHERE user_id = ?
       ORDER BY activity_date DESC
       LIMIT ?`,
      [userId, days]
    );

    res.json({
      success: true,
      activity
    });
  } catch (error) {
    console.error('Get activity history error:', error);
    res.status(500).json({ success: false, message: 'Error fetching activity history' });
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
  updateTimezone,
  getActivityHistory
};
