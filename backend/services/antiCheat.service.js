const { pool } = require('../config/database');

// Anti-cheat configuration
const ANTI_CHEAT_CONFIG = {
  MIN_LESSON_TIME_SECONDS: 30,         // Minimum time before completion allowed
  MAX_LESSONS_PER_HOUR: 20,            // Rate limit per hour
  MAX_LESSONS_PER_DAY: 100,            // Daily cap
  MIN_VIDEO_WATCH_PERCENTAGE: 0.7,     // 70% of video must be watched
  SUSPICIOUS_COMPLETION_SPEED: 10,     // Seconds - flag if too fast
  IP_COOLDOWN_MINUTES: 1,              // Same IP can't complete same lesson twice quickly
  DETECT_FAST_COMPLETION_COUNT: 10,    // Flag if > 10 fast completions in 7 days
  DETECT_MULTI_IP_THRESHOLD: 3         // Flag if > 3 IPs in 1 hour
};

/**
 * Validate lesson completion attempt
 * @param {Connection} connection - Database connection
 * @param {number} userId - User ID
 * @param {number} lessonId - Lesson ID
 * @param {Object} metadata - Completion metadata (timeSpentSeconds, ip, userAgent, etc.)
 * @returns {Promise<Object>} - { allowed: boolean, reason?: string, isSuspicious: boolean, checks: Array }
 */
async function validateLessonCompletion(connection, userId, lessonId, metadata) {
  const checks = [];
  let isSuspicious = false;

  // 1. Check minimum time spent
  if (metadata.timeSpentSeconds < ANTI_CHEAT_CONFIG.MIN_LESSON_TIME_SECONDS) {
    checks.push({
      check: 'min_time',
      passed: false,
      value: metadata.timeSpentSeconds,
      threshold: ANTI_CHEAT_CONFIG.MIN_LESSON_TIME_SECONDS
    });
    isSuspicious = true;
  }

  // Flag if extremely fast
  if (metadata.timeSpentSeconds < ANTI_CHEAT_CONFIG.SUSPICIOUS_COMPLETION_SPEED) {
    isSuspicious = true;
  }

  // 2. Rate limiting - lessons per hour
  const [hourlyCount] = await connection.query(
    `SELECT COUNT(*) as count FROM lesson_progress lp
     JOIN enrollments e ON lp.enrollment_id = e.id
     WHERE e.user_id = ? AND lp.completed_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [userId]
  );

  if (hourlyCount[0].count >= ANTI_CHEAT_CONFIG.MAX_LESSONS_PER_HOUR) {
    checks.push({
      check: 'hourly_rate',
      passed: false,
      value: hourlyCount[0].count,
      threshold: ANTI_CHEAT_CONFIG.MAX_LESSONS_PER_HOUR
    });
    return {
      allowed: false,
      reason: 'rate_limit_hourly',
      message: `Rate limit exceeded. Maximum ${ANTI_CHEAT_CONFIG.MAX_LESSONS_PER_HOUR} lessons per hour.`,
      isSuspicious: false,
      checks
    };
  }

  // 3. Daily rate limiting
  const [dailyCount] = await connection.query(
    `SELECT COUNT(*) as count FROM lesson_progress lp
     JOIN enrollments e ON lp.enrollment_id = e.id
     WHERE e.user_id = ? AND lp.completed_at > DATE_SUB(NOW(), INTERVAL 1 DAY)`,
    [userId]
  );

  if (dailyCount[0].count >= ANTI_CHEAT_CONFIG.MAX_LESSONS_PER_DAY) {
    checks.push({
      check: 'daily_rate',
      passed: false,
      value: dailyCount[0].count,
      threshold: ANTI_CHEAT_CONFIG.MAX_LESSONS_PER_DAY
    });
    return {
      allowed: false,
      reason: 'rate_limit_daily',
      message: `Daily limit exceeded. Maximum ${ANTI_CHEAT_CONFIG.MAX_LESSONS_PER_DAY} lessons per day.`,
      isSuspicious: false,
      checks
    };
  }

  // 4. Check for duplicate completion (same lesson, same IP, short time)
  if (metadata.ip) {
    const [recentSameLesson] = await connection.query(
      `SELECT * FROM activity_audit_log
       WHERE user_id = ? AND entity_type = 'lesson' AND entity_id = ?
       AND action_type = 'complete'
       AND ip_address = ?
       AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [userId, lessonId, metadata.ip, ANTI_CHEAT_CONFIG.IP_COOLDOWN_MINUTES]
    );

    if (recentSameLesson.length > 0) {
      checks.push({
        check: 'duplicate_attempt',
        passed: false
      });
      return {
        allowed: false,
        reason: 'duplicate_too_soon',
        message: 'Please wait before attempting to complete this lesson again.',
        isSuspicious: true,
        checks
      };
    }
  }

  // 5. Check if lesson was already completed before
  const [existingProgress] = await connection.query(
    `SELECT lp.is_completed FROM lesson_progress lp
     JOIN enrollments e ON lp.enrollment_id = e.id
     WHERE e.user_id = ? AND lp.lesson_id = ?`,
    [userId, lessonId]
  );

  if (existingProgress.length > 0 && existingProgress[0].is_completed) {
    // Already completed - allow but don't award XP/badges
    return {
      allowed: true,
      alreadyCompleted: true,
      isSuspicious: false,
      checks
    };
  }

  // 6. Log the activity for audit
  try {
    await connection.query(
      `INSERT INTO activity_audit_log
       (user_id, action_type, entity_type, entity_id, ip_address, user_agent, metadata, is_suspicious)
       VALUES (?, 'complete', 'lesson', ?, ?, ?, ?, ?)`,
      [
        userId,
        lessonId,
        metadata.ip || null,
        metadata.userAgent || null,
        JSON.stringify({
          timeSpent: metadata.timeSpentSeconds,
          timestamp: new Date().toISOString()
        }),
        isSuspicious
      ]
    );
  } catch (error) {
    console.error('Failed to log activity audit:', error);
    // Don't fail the request if audit logging fails
  }

  return {
    allowed: true,
    isSuspicious,
    checks,
    alreadyCompleted: false
  };
}

/**
 * Detect suspicious patterns (run as background job or periodic check)
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Array of detected suspicious patterns
 */
async function detectSuspiciousActivity(userId) {
  const flags = [];

  // Pattern 1: Completing lessons faster than reasonable
  const [fastCompletions] = await pool.query(
    `SELECT COUNT(*) as count FROM activity_audit_log
     WHERE user_id = ?
     AND action_type = 'complete'
     AND entity_type = 'lesson'
     AND JSON_EXTRACT(metadata, '$.timeSpent') < ?
     AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [userId, ANTI_CHEAT_CONFIG.SUSPICIOUS_COMPLETION_SPEED]
  );

  if (fastCompletions[0].count >= ANTI_CHEAT_CONFIG.DETECT_FAST_COMPLETION_COUNT) {
    flags.push({
      type: 'fast_completion_pattern',
      count: fastCompletions[0].count,
      severity: 'high',
      message: `${fastCompletions[0].count} lessons completed in less than ${ANTI_CHEAT_CONFIG.SUSPICIOUS_COMPLETION_SPEED} seconds in the last 7 days`
    });
  }

  // Pattern 2: Multiple devices/IPs in short period
  const [multipleIPs] = await pool.query(
    `SELECT COUNT(DISTINCT ip_address) as count FROM activity_audit_log
     WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
     AND ip_address IS NOT NULL`,
    [userId]
  );

  if (multipleIPs[0].count > ANTI_CHEAT_CONFIG.DETECT_MULTI_IP_THRESHOLD) {
    flags.push({
      type: 'multiple_ips',
      count: multipleIPs[0].count,
      severity: 'medium',
      message: `${multipleIPs[0].count} different IP addresses in the last hour`
    });
  }

  // Pattern 3: Excessive activity (abnormal lesson completion rate)
  const [excessiveActivity] = await pool.query(
    `SELECT COUNT(*) as count FROM lesson_progress lp
     JOIN enrollments e ON lp.enrollment_id = e.id
     WHERE e.user_id = ?
     AND lp.completed_at > DATE_SUB(NOW(), INTERVAL 1 DAY)`,
    [userId]
  );

  if (excessiveActivity[0].count > 50) {
    flags.push({
      type: 'excessive_activity',
      count: excessiveActivity[0].count,
      severity: 'medium',
      message: `${excessiveActivity[0].count} lessons completed in 24 hours`
    });
  }

  return flags;
}

/**
 * Get suspicious activity report for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Suspicious activity report
 */
async function getSuspiciousActivityReport(userId) {
  // Get flagged audit logs
  const [suspiciousLogs] = await pool.query(
    `SELECT * FROM activity_audit_log
     WHERE user_id = ? AND is_suspicious = TRUE
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );

  // Get recent activity statistics
  const [activityStats] = await pool.query(
    `SELECT
        COUNT(*) as totalCompletions,
        AVG(JSON_EXTRACT(metadata, '$.timeSpent')) as avgTimeSpent,
        MIN(JSON_EXTRACT(metadata, '$.timeSpent')) as minTimeSpent,
        MAX(JSON_EXTRACT(metadata, '$.timeSpent')) as maxTimeSpent,
        COUNT(DISTINCT ip_address) as uniqueIPs
     FROM activity_audit_log
     WHERE user_id = ?
     AND action_type = 'complete'
     AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [userId]
  );

  // Detect patterns
  const patterns = await detectSuspiciousActivity(userId);

  return {
    userId,
    suspiciousLogs,
    activityStats: activityStats[0],
    detectedPatterns: patterns,
    riskLevel: patterns.some(p => p.severity === 'high') ? 'high' : patterns.length > 0 ? 'medium' : 'low'
  };
}

/**
 * Clear suspicious flags (admin action after review)
 * @param {number} userId - User ID
 * @returns {Promise<number>} - Number of flags cleared
 */
async function clearSuspiciousFlags(userId) {
  const [result] = await pool.query(
    'UPDATE activity_audit_log SET is_suspicious = FALSE WHERE user_id = ? AND is_suspicious = TRUE',
    [userId]
  );

  return result.affectedRows;
}

module.exports = {
  ANTI_CHEAT_CONFIG,
  validateLessonCompletion,
  detectSuspiciousActivity,
  getSuspiciousActivityReport,
  clearSuspiciousFlags
};
