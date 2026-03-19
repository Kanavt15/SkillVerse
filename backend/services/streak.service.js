const { pool } = require('../config/database');

// Streak configuration
const STREAK_CONFIG = {
  ACTIVITY_THRESHOLD_MINUTES: 10,  // Minimum time spent to count as activity
  GRACE_PERIOD_HOURS: 4,            // 4 AM cutoff - before this counts as previous day
  STREAK_MILESTONES: [3, 7, 14, 30, 60, 100, 365]  // Days that trigger notifications
};

/**
 * Calculate user's activity date based on their timezone
 * Considers a 4 AM grace period (learning at 2 AM counts as "yesterday")
 * @param {string} userTimezone - IANA timezone (e.g., 'America/New_York', 'UTC')
 * @returns {string} - Date in YYYY-MM-DD format
 */
function getUserActivityDate(userTimezone = 'UTC') {
  try {
    const now = new Date();
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));

    // If before 4 AM, count as previous day
    if (userTime.getHours() < STREAK_CONFIG.GRACE_PERIOD_HOURS) {
      userTime.setDate(userTime.getDate() - 1);
    }

    return userTime.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch (error) {
    console.error('Invalid timezone, falling back to UTC:', userTimezone);
    const now = new Date();
    return now.toISOString().split('T')[0];
  }
}

/**
 * Calculate the difference in days between two dates
 * @param {string} date1 - Earlier date (YYYY-MM-DD)
 * @param {string} date2 - Later date (YYYY-MM-DD)
 * @returns {number} - Days difference
 */
function calculateDaysDifference(date1, date2) {
  const d1 = new Date(date1 + 'T00:00:00Z');
  const d2 = new Date(date2 + 'T00:00:00Z');
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check and update user streak after an activity
 * @param {Connection} connection - Database connection (should be in transaction)
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Streak update result
 */
async function updateStreakOnActivity(connection, userId) {
  // 1. Get user's current streak data and timezone
  const [users] = await connection.query(
    `SELECT current_streak, longest_streak, streak_last_activity_date,
            streak_freeze_count, timezone
     FROM users WHERE id = ?`,
    [userId]
  );

  if (users.length === 0) {
    throw new Error('User not found');
  }

  const user = users[0];
  const userTimezone = user.timezone || 'UTC';
  const activityDate = getUserActivityDate(userTimezone);
  const lastActivityDate = user.streak_last_activity_date;

  // 2. Check if already logged activity today
  const [existingActivity] = await connection.query(
    `SELECT * FROM daily_activity_log WHERE user_id = ? AND activity_date = ?`,
    [userId, activityDate]
  );

  const isFirstActivityToday = existingActivity.length === 0;

  // 3. Calculate streak status
  let newStreak = user.current_streak;
  let streakBroken = false;
  let streakExtended = false;
  let freezeUsed = false;
  let streakMilestone = null;

  if (!lastActivityDate) {
    // First ever activity
    newStreak = 1;
    streakExtended = true;
  } else {
    const daysDiff = calculateDaysDifference(lastActivityDate, activityDate);

    if (daysDiff === 0) {
      // Same day - no streak change needed
    } else if (daysDiff === 1) {
      // Consecutive day - extend streak
      newStreak = user.current_streak + 1;
      streakExtended = true;

      // Check if this is a milestone
      if (STREAK_CONFIG.STREAK_MILESTONES.includes(newStreak)) {
        streakMilestone = newStreak;
      }
    } else if (daysDiff === 2 && user.streak_freeze_count > 0) {
      // Missed one day but has freeze available
      const missedDate = new Date(lastActivityDate);
      missedDate.setDate(missedDate.getDate() + 1);
      const missedDateStr = missedDate.toISOString().split('T')[0];

      newStreak = user.current_streak + 1;
      streakExtended = true;
      freezeUsed = true;

      // Record freeze usage
      await connection.query(
        `INSERT INTO streak_freezes (user_id, freeze_date, reason) VALUES (?, ?, 'purchased')`,
        [userId, missedDateStr]
      );

      // Decrement freeze count
      await connection.query(
        'UPDATE users SET streak_freeze_count = streak_freeze_count - 1 WHERE id = ?',
        [userId]
      );
    } else if (daysDiff > 1) {
      // Streak broken
      newStreak = 1;
      streakBroken = true;
    }
  }

  // 4. Update user streak data
  const longestStreak = Math.max(user.longest_streak, newStreak);

  await connection.query(
    `UPDATE users SET
        current_streak = ?,
        longest_streak = ?,
        streak_last_activity_date = ?
     WHERE id = ?`,
    [newStreak, longestStreak, activityDate, userId]
  );

  // 5. Update or insert daily activity log
  if (isFirstActivityToday) {
    await connection.query(
      `INSERT INTO daily_activity_log (user_id, activity_date, lessons_completed, streak_maintained)
       VALUES (?, ?, 1, TRUE)`,
      [userId, activityDate]
    );
  } else {
    await connection.query(
      `UPDATE daily_activity_log
       SET lessons_completed = lessons_completed + 1,
           streak_maintained = TRUE
       WHERE user_id = ? AND activity_date = ?`,
      [userId, activityDate]
    );
  }

  return {
    currentStreak: newStreak,
    longestStreak,
    streakExtended,
    streakBroken,
    freezeUsed,
    isFirstActivityToday,
    streakMilestone,
    activityDate
  };
}

/**
 * Update daily activity log with XP earned
 * @param {Connection} connection - Database connection
 * @param {number} userId - User ID
 * @param {number} xpAmount - XP amount to add
 */
async function updateDailyXP(connection, userId, xpAmount) {
  const activityDate = getUserActivityDate('UTC'); // Use UTC for consistency

  await connection.query(
    `UPDATE daily_activity_log
     SET xp_earned = xp_earned + ?
     WHERE user_id = ? AND activity_date = ?`,
    [xpAmount, userId, activityDate]
  );
}

/**
 * Get user's streak information
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Streak info including risk status
 */
async function getStreakInfo(userId) {
  const [users] = await pool.query(
    `SELECT current_streak, longest_streak, streak_last_activity_date,
            streak_freeze_count, timezone
     FROM users WHERE id = ?`,
    [userId]
  );

  if (users.length === 0) {
    throw new Error('User not found');
  }

  const user = users[0];
  const userTimezone = user.timezone || 'UTC';
  const todayDate = getUserActivityDate(userTimezone);

  // Check if user has activity today
  const [todayActivity] = await pool.query(
    `SELECT * FROM daily_activity_log WHERE user_id = ? AND activity_date = ?`,
    [userId, todayDate]
  );

  const hasActivityToday = todayActivity.length > 0;

  // Calculate if streak is at risk
  let isAtRisk = false;
  if (user.current_streak > 0 && !hasActivityToday) {
    const lastActivityDate = user.streak_last_activity_date;
    if (lastActivityDate) {
      const daysDiff = calculateDaysDifference(lastActivityDate, todayDate);
      // At risk if last activity was yesterday and no activity today
      isAtRisk = daysDiff === 1;
    }
  }

  // Get recent activity history (last 7 days)
  const [recentActivity] = await pool.query(
    `SELECT activity_date, lessons_completed, xp_earned
     FROM daily_activity_log
     WHERE user_id = ?
     ORDER BY activity_date DESC
     LIMIT 7`,
    [userId]
  );

  return {
    currentStreak: user.current_streak,
    longestStreak: user.longest_streak,
    lastActivityDate: user.streak_last_activity_date,
    freezesAvailable: user.streak_freeze_count,
    hasActivityToday,
    isAtRisk,
    recentActivity,
    nextMilestone: STREAK_CONFIG.STREAK_MILESTONES.find(m => m > user.current_streak) || null
  };
}

/**
 * Purchase a streak freeze for points
 * @param {number} userId - User ID
 * @param {number} pointsCost - Points to charge
 * @returns {Promise<Object>} - Purchase result
 */
async function purchaseStreakFreeze(userId, pointsCost = 100) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check user has enough points
    const [users] = await connection.query(
      'SELECT points, streak_freeze_count FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    if (users[0].points < pointsCost) {
      throw new Error('Insufficient points');
    }

    // Deduct points
    await connection.query(
      'UPDATE users SET points = points - ?, streak_freeze_count = streak_freeze_count + 1 WHERE id = ?',
      [pointsCost, userId]
    );

    // Record transaction
    await connection.query(
      'INSERT INTO point_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
      [userId, pointsCost, 'spent', 'Purchased streak freeze']
    );

    await connection.commit();

    return {
      success: true,
      freezesAvailable: users[0].streak_freeze_count + 1,
      pointsSpent: pointsCost
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  STREAK_CONFIG,
  getUserActivityDate,
  calculateDaysDifference,
  updateStreakOnActivity,
  updateDailyXP,
  getStreakInfo,
  purchaseStreakFreeze
};
