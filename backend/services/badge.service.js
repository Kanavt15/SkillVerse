const { pool } = require('../config/database');
const { awardXP } = require('./xp.service');

/**
 * Get comprehensive user statistics for badge checking
 * @param {Connection} connection - Database connection
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - User statistics
 */
async function getUserStats(connection, userId) {
  const [stats] = await connection.query(
    `SELECT
        u.xp as totalXP,
        u.level,
        u.current_streak as currentStreak,
        u.longest_streak as longestStreak,
        (SELECT COUNT(*) FROM enrollments WHERE user_id = ? AND completed_at IS NOT NULL) as coursesCompleted,
        (SELECT COUNT(*) FROM lesson_progress lp
         JOIN enrollments e ON lp.enrollment_id = e.id
         WHERE e.user_id = ? AND lp.is_completed = TRUE) as lessonsCompleted,
        (SELECT COUNT(*) FROM reviews WHERE user_id = ?) as reviewsPosted,
        (SELECT COUNT(*) FROM discussion_posts WHERE user_id = ? AND parent_id IS NULL) as discussionsPosts,
        (SELECT COALESCE(SUM(upvote_count), 0) FROM discussion_posts WHERE user_id = ?) as helpfulVotes,
        (SELECT COUNT(*) FROM certificates WHERE user_id = ?) as certificates,
        (SELECT COUNT(DISTINCT c.category_id) FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE e.user_id = ? AND e.completed_at IS NOT NULL) as categoriesCompleted,
        (SELECT COALESCE(SUM(time_spent_minutes), 0) FROM daily_activity_log WHERE user_id = ?) as totalTimeSpentMinutes
    FROM users u WHERE u.id = ?`,
    [userId, userId, userId, userId, userId, userId, userId, userId, userId]
  );

  if (stats.length === 0) {
    throw new Error('User not found');
  }

  return stats[0];
}

/**
 * Check if a badge criteria is met
 * @param {Object} badge - Badge definition
 * @param {Object} stats - User statistics
 * @param {Object} metadata - Additional context (e.g., hour of day, course difficulty)
 * @returns {boolean} - Whether criteria is met
 */
function checkBadgeCriteria(badge, stats, metadata = {}) {
  switch (badge.criteria_type) {
    case 'streak_days':
      return stats.currentStreak >= badge.criteria_value;

    case 'courses_completed':
      return stats.coursesCompleted >= badge.criteria_value;

    case 'lessons_completed':
      return stats.lessonsCompleted >= badge.criteria_value;

    case 'total_xp':
      return stats.totalXP >= badge.criteria_value;

    case 'level_reached':
      return stats.level >= badge.criteria_value;

    case 'time_spent_hours':
      const hoursSpent = stats.totalTimeSpentMinutes / 60;
      return hoursSpent >= badge.criteria_value;

    case 'reviews_posted':
      return stats.reviewsPosted >= badge.criteria_value;

    case 'discussions_posted':
      return stats.discussionsPosts >= badge.criteria_value;

    case 'helpful_answers':
      return stats.helpfulVotes >= badge.criteria_value;

    case 'certificates_earned':
      return stats.certificates >= badge.criteria_value;

    case 'categories_explored':
      return stats.categoriesCompleted >= badge.criteria_value;

    case 'early_bird':
      return metadata.hour !== undefined && metadata.hour < 8;

    case 'night_owl':
      return metadata.hour !== undefined && metadata.hour >= 22;

    case 'weekend_warrior':
      // Would need custom logic to check 4 consecutive weekends
      return metadata.consecutiveWeekends >= badge.criteria_value;

    case 'perfect_course':
      // Would need to check if all lessons in a course were completed with 100%
      return metadata.perfectCourse === true;

    default:
      return false;
  }
}

/**
 * Check all badges and award any newly earned ones
 * @param {Connection} connection - Database connection (in transaction)
 * @param {number} userId - User ID
 * @param {Object} metadata - Additional context for badge checking
 * @returns {Promise<Array>} - Array of newly awarded badges
 */
async function checkAndAwardBadges(connection, userId, metadata = {}) {
  const awardedBadges = [];

  // Get user stats
  const stats = await getUserStats(connection, userId);

  // Get all badges user hasn't earned yet
  const [unearnedBadges] = await connection.query(
    `SELECT bd.* FROM badge_definitions bd
     LEFT JOIN user_badges ub ON bd.id = ub.badge_id AND ub.user_id = ?
     WHERE ub.id IS NULL AND bd.is_active = TRUE`,
    [userId]
  );

  for (const badge of unearnedBadges) {
    const earned = checkBadgeCriteria(badge, stats, metadata);

    if (earned) {
      // Award badge
      await connection.query(
        'INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)',
        [userId, badge.id]
      );

      // Award XP for badge
      if (badge.xp_reward > 0) {
        await awardXP(
          connection,
          userId,
          'badge_earned',
          badge.xp_reward,
          `Badge earned: ${badge.name}`,
          badge.id,
          'badge'
        );
      }

      awardedBadges.push(badge);
    }
  }

  return awardedBadges;
}

/**
 * Get all badges earned by a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Earned badges with details
 */
async function getUserBadges(userId) {
  const [badges] = await pool.query(
    `SELECT bd.*, ub.earned_at, ub.is_featured
     FROM user_badges ub
     JOIN badge_definitions bd ON ub.badge_id = bd.id
     WHERE ub.user_id = ?
     ORDER BY ub.earned_at DESC`,
    [userId]
  );

  return badges;
}

/**
 * Get all available badges (for showcase)
 * @param {number|null} userId - Optional user ID to check which are earned
 * @returns {Promise<Array>} - All badges with earned status
 */
async function getAllBadges(userId = null) {
  if (userId) {
    const [badges] = await pool.query(
      `SELECT bd.*,
              CASE WHEN ub.id IS NOT NULL THEN TRUE ELSE FALSE END as earned,
              ub.earned_at,
              ub.is_featured
       FROM badge_definitions bd
       LEFT JOIN user_badges ub ON bd.id = ub.badge_id AND ub.user_id = ?
       WHERE bd.is_active = TRUE
       ORDER BY bd.category, bd.tier, bd.criteria_value`,
      [userId]
    );
    return badges;
  } else {
    const [badges] = await pool.query(
      `SELECT * FROM badge_definitions
       WHERE is_active = TRUE
       ORDER BY category, tier, criteria_value`
    );
    return badges;
  }
}

/**
 * Toggle featured status for a badge
 * @param {number} userId - User ID
 * @param {number} badgeId - Badge ID
 * @returns {Promise<boolean>} - New featured status
 */
async function toggleFeaturedBadge(userId, badgeId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check if user has this badge
    const [userBadges] = await connection.query(
      'SELECT is_featured FROM user_badges WHERE user_id = ? AND badge_id = ?',
      [userId, badgeId]
    );

    if (userBadges.length === 0) {
      throw new Error('Badge not earned');
    }

    const currentStatus = userBadges[0].is_featured;

    if (!currentStatus) {
      // Unfeatured all other badges first (only one can be featured)
      await connection.query(
        'UPDATE user_badges SET is_featured = FALSE WHERE user_id = ?',
        [userId]
      );
    }

    // Toggle the featured status
    await connection.query(
      'UPDATE user_badges SET is_featured = ? WHERE user_id = ? AND badge_id = ?',
      [!currentStatus, userId, badgeId]
    );

    await connection.commit();

    return !currentStatus;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get badge statistics
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Badge statistics
 */
async function getBadgeStats(userId) {
  const [stats] = await pool.query(
    `SELECT
        COUNT(DISTINCT ub.badge_id) as totalEarned,
        COUNT(DISTINCT CASE WHEN bd.tier = 'bronze' THEN ub.badge_id END) as bronzeCount,
        COUNT(DISTINCT CASE WHEN bd.tier = 'silver' THEN ub.badge_id END) as silverCount,
        COUNT(DISTINCT CASE WHEN bd.tier = 'gold' THEN ub.badge_id END) as goldCount,
        COUNT(DISTINCT CASE WHEN bd.tier = 'platinum' THEN ub.badge_id END) as platinumCount,
        COUNT(DISTINCT CASE WHEN bd.tier = 'diamond' THEN ub.badge_id END) as diamondCount,
        (SELECT COUNT(*) FROM badge_definitions WHERE is_active = TRUE) as totalAvailable
     FROM user_badges ub
     JOIN badge_definitions bd ON ub.badge_id = bd.id
     WHERE ub.user_id = ?`,
    [userId]
  );

  return stats[0];
}

module.exports = {
  getUserStats,
  checkBadgeCriteria,
  checkAndAwardBadges,
  getUserBadges,
  getAllBadges,
  toggleFeaturedBadge,
  getBadgeStats
};
