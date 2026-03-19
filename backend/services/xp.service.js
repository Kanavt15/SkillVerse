const { pool } = require('../config/database');

// XP event definitions
const XP_EVENTS = {
  LESSON_COMPLETE: { base: 10, event: 'lesson_complete' },
  FIRST_LESSON_DAILY: { base: 5, event: 'first_lesson_daily' },
  COURSE_COMPLETE: {
    beginner: 50,
    intermediate: 100,
    advanced: 150,
    event: 'course_complete'
  },
  STREAK_BONUS: {
    7: 25,
    14: 50,
    30: 100,
    60: 250,
    100: 500,
    365: 2000,
    event: 'streak_bonus'
  },
  DISCUSSION_POST: { base: 5, dailyLimit: 5, event: 'discussion_post' },
  DISCUSSION_HELPFUL: { base: 10, event: 'discussion_helpful' },
  REVIEW_POSTED: { base: 15, dailyLimit: 3, event: 'review_posted' },
  TIME_SPENT_BONUS: { per30Min: 5, dailyMax: 20, event: 'milestone_bonus' }
};

/**
 * Calculate level from total XP
 * Formula: level = floor((xp / 100)^(2/3)) + 1
 * This creates a smooth curve that's not too punishing early on
 */
function calculateLevel(totalXP) {
  if (totalXP <= 0) return 1;
  return Math.floor(Math.pow(totalXP / 100, 2/3)) + 1;
}

/**
 * Get XP required to reach a specific level
 * Formula: XP = 100 * (level - 1)^1.5
 */
function getXPForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level - 1, 1.5));
}

/**
 * Get detailed XP progress information
 */
function getXPProgress(totalXP) {
  const currentLevel = calculateLevel(totalXP);
  const xpForCurrentLevel = getXPForLevel(currentLevel);
  const xpForNextLevel = getXPForLevel(currentLevel + 1);
  const xpInCurrentLevel = totalXP - xpForCurrentLevel;
  const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;

  return {
    level: currentLevel,
    totalXP,
    xpInCurrentLevel,
    xpNeededForNext,
    progressPercentage: xpNeededForNext > 0
      ? Math.round((xpInCurrentLevel / xpNeededForNext) * 100)
      : 100
  };
}

/**
 * Award XP to a user
 * @param {Connection} connection - Database connection (transaction)
 * @param {number} userId - User ID
 * @param {string} eventType - Event type from XP_EVENTS
 * @param {number} amount - XP amount to award
 * @param {string} description - Transaction description
 * @param {number|null} referenceId - Reference entity ID
 * @param {string|null} referenceType - Reference entity type
 * @returns {Promise<Object>} - { xp, level, leveledUp, previousLevel }
 */
async function awardXP(connection, userId, eventType, amount, description, referenceId = null, referenceType = null) {
  // 1. Add XP to user
  await connection.query(
    'UPDATE users SET xp = xp + ? WHERE id = ?',
    [amount, userId]
  );

  // 2. Log transaction
  await connection.query(
    `INSERT INTO xp_transactions (user_id, amount, event_type, description, reference_id, reference_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, amount, eventType, description, referenceId, referenceType]
  );

  // 3. Get new XP total and calculate level
  const [users] = await connection.query(
    'SELECT xp, level FROM users WHERE id = ?',
    [userId]
  );

  const newXP = users[0].xp;
  const currentLevel = users[0].level;
  const newLevel = calculateLevel(newXP);

  // 4. Level up if needed
  if (newLevel > currentLevel) {
    await connection.query(
      'UPDATE users SET level = ? WHERE id = ?',
      [newLevel, userId]
    );

    return { xp: newXP, level: newLevel, leveledUp: true, previousLevel: currentLevel };
  }

  return { xp: newXP, level: currentLevel, leveledUp: false };
}

/**
 * Check daily limits for repeatable XP events
 * @param {Connection} connection - Database connection
 * @param {number} userId - User ID
 * @param {string} eventType - Event type to check
 * @param {number} limit - Daily limit
 * @returns {Promise<boolean>} - True if under limit
 */
async function checkDailyXPLimit(connection, userId, eventType, limit) {
  const today = new Date().toISOString().split('T')[0];

  const [result] = await connection.query(
    `SELECT COUNT(*) as count FROM xp_transactions
     WHERE user_id = ? AND event_type = ? AND DATE(created_at) = ?`,
    [userId, eventType, today]
  );

  return result[0].count < limit;
}

/**
 * Award XP for lesson completion
 * @param {Connection} connection - Database connection
 * @param {number} userId - User ID
 * @param {number} lessonId - Lesson ID
 * @param {string} lessonTitle - Lesson title for description
 * @param {boolean} isFirstToday - Whether this is the first lesson completed today
 * @returns {Promise<Object>} - XP and level info
 */
async function awardLessonXP(connection, userId, lessonId, lessonTitle, isFirstToday) {
  let totalXP = 0;
  const results = [];

  // Base lesson completion XP
  const baseXP = XP_EVENTS.LESSON_COMPLETE.base;
  const baseResult = await awardXP(
    connection,
    userId,
    XP_EVENTS.LESSON_COMPLETE.event,
    baseXP,
    `Completed lesson: ${lessonTitle}`,
    lessonId,
    'lesson'
  );
  totalXP += baseXP;
  results.push({ type: 'lesson_complete', xp: baseXP });

  // Bonus for first lesson of the day
  if (isFirstToday) {
    const bonusXP = XP_EVENTS.FIRST_LESSON_DAILY.base;
    await awardXP(
      connection,
      userId,
      XP_EVENTS.FIRST_LESSON_DAILY.event,
      bonusXP,
      'First lesson of the day bonus',
      lessonId,
      'lesson'
    );
    totalXP += bonusXP;
    results.push({ type: 'first_daily', xp: bonusXP });
  }

  return {
    totalXP,
    results,
    ...baseResult
  };
}

/**
 * Award XP for course completion
 * @param {Connection} connection - Database connection
 * @param {number} userId - User ID
 * @param {number} courseId - Course ID
 * @param {string} courseTitle - Course title
 * @param {string} difficulty - Course difficulty (beginner/intermediate/advanced)
 * @returns {Promise<Object>} - XP and level info
 */
async function awardCourseXP(connection, userId, courseId, courseTitle, difficulty) {
  const xpAmount = XP_EVENTS.COURSE_COMPLETE[difficulty] || XP_EVENTS.COURSE_COMPLETE.beginner;

  const result = await awardXP(
    connection,
    userId,
    XP_EVENTS.COURSE_COMPLETE.event,
    xpAmount,
    `Completed course: ${courseTitle}`,
    courseId,
    'course'
  );

  return { ...result, xpAwarded: xpAmount };
}

/**
 * Award XP for streak milestone
 * @param {Connection} connection - Database connection
 * @param {number} userId - User ID
 * @param {number} streakDays - Streak days reached
 * @returns {Promise<Object|null>} - XP and level info or null if no bonus for this milestone
 */
async function awardStreakBonusXP(connection, userId, streakDays) {
  const xpAmount = XP_EVENTS.STREAK_BONUS[streakDays];

  if (!xpAmount) {
    return null; // No bonus for this streak milestone
  }

  const result = await awardXP(
    connection,
    userId,
    XP_EVENTS.STREAK_BONUS.event,
    xpAmount,
    `${streakDays}-day streak milestone`,
    streakDays,
    null
  );

  return { ...result, xpAwarded: xpAmount };
}

module.exports = {
  XP_EVENTS,
  calculateLevel,
  getXPForLevel,
  getXPProgress,
  awardXP,
  checkDailyXPLimit,
  awardLessonXP,
  awardCourseXP,
  awardStreakBonusXP
};
