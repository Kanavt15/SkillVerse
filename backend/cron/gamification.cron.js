const cron = require('node-cron');
const { pool } = require('../config/database');
const { createNotification } = require('../controllers/notification.controller');
const { cleanupExpiredTokens } = require('../utils/token.utils');

/**
 * Daily Streak Check - Notify users at risk of losing streaks
 * Runs at 6 PM and 11 PM UTC to remind users before day ends
 */
const checkStreaksAtRisk = async () => {
  console.log('[CRON] Running streak-at-risk check...');

  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // Find users who had activity yesterday but not today, and have streaks >= 3
    const [atRiskUsers] = await pool.query(`
      SELECT u.id, u.full_name, u.current_streak, u.streak_freeze_count, u.timezone
      FROM users u
      WHERE u.current_streak >= 3
      AND u.streak_last_activity_date = ?
      AND NOT EXISTS (
        SELECT 1 FROM daily_activity_log dal
        WHERE dal.user_id = u.id
        AND dal.activity_date = ?
      )
    `, [yesterday, today]);

    for (const user of atRiskUsers) {
      try {
        // Send notification
        await createNotification(
          user.id,
          'streak_at_risk',
          'Streak at Risk!',
          `Your ${user.current_streak}-day streak is at risk! Complete a lesson today to keep it going.${user.streak_freeze_count > 0 ? ' You have ' + user.streak_freeze_count + ' freeze(s) available.' : ''}`,
          null
        );
      } catch (error) {
        console.error(`Failed to notify user ${user.id}:`, error);
      }
    }

    console.log(`[CRON] Notified ${atRiskUsers.length} users about streak risk`);
  } catch (error) {
    console.error('[CRON] Error in streak risk check:', error);
  }
};

/**
 * Weekly cleanup of old audit logs
 * Runs on Sunday at 3 AM UTC
 */
const cleanupOldAuditLogs = async () => {
  console.log('[CRON] Cleaning old audit logs...');

  try {
    // Keep suspicious logs longer (90 days), regular logs 30 days
    const [result] = await pool.query(`
      DELETE FROM activity_audit_log
      WHERE (is_suspicious = FALSE AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
      OR (is_suspicious = TRUE AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY))
    `);

    console.log(`[CRON] Audit log cleanup complete. Deleted ${result.affectedRows} records.`);
  } catch (error) {
    console.error('[CRON] Error in audit log cleanup:', error);
  }
};

/**
 * Daily maintenance tasks
 * Runs at 2 AM UTC daily
 */
const dailyMaintenance = async () => {
  console.log('[CRON] Running daily maintenance...');

  try {
    // 1. Clean up old daily activity logs (keep 1 year)
    const [activityResult] = await pool.query(`
      DELETE FROM daily_activity_log
      WHERE activity_date < DATE_SUB(CURDATE(), INTERVAL 365 DAY)
    `);

    // 2. Clean up old XP transactions (keep 2 years)
    const [xpResult] = await pool.query(`
      DELETE FROM xp_transactions
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR)
    `);

    console.log(`[CRON] Daily maintenance complete. Cleaned ${activityResult.affectedRows} activity logs, ${xpResult.affectedRows} XP transactions.`);
  } catch (error) {
    console.error('[CRON] Error in daily maintenance:', error);
  }
};

/**
 * Weekly leaderboard snapshot (for analytics/history)
 * Runs on Monday at 1 AM UTC
 */
const weeklyLeaderboardSnapshot = async () => {
  console.log('[CRON] Creating weekly leaderboard snapshot...');

  try {
    // Get top 100 users by XP
    const [topUsers] = await pool.query(`
      SELECT
        id,
        full_name,
        xp,
        level,
        current_streak,
        NOW() as snapshot_date,
        'weekly' as snapshot_type
      FROM users
      WHERE role = 'learner'
      ORDER BY xp DESC
      LIMIT 100
    `);

    // Could store these in a leaderboard_history table if needed
    console.log(`[CRON] Weekly leaderboard snapshot created with ${topUsers.length} users`);
  } catch (error) {
    console.error('[CRON] Error in leaderboard snapshot:', error);
  }
};

/**
 * Daily cleanup of expired refresh tokens
 * Runs at 3 AM UTC daily
 */
const cleanupRefreshTokens = async () => {
  console.log('[CRON] Cleaning expired refresh tokens...');

  try {
    const deleted = await cleanupExpiredTokens();
    console.log(`[CRON] Refresh token cleanup complete. Deleted ${deleted} records.`);
  } catch (error) {
    console.error('[CRON] Error in refresh token cleanup:', error);
  }
};

/**
 * Check for inactive users and send re-engagement notifications
 * Runs every 3 days at 10 AM UTC
 */
const checkInactiveUsers = async () => {
  console.log('[CRON] Checking for inactive users...');

  try {
    // Find users who haven't been active for 7 days but were active in the last 30 days
    const [inactiveUsers] = await pool.query(`
      SELECT u.id, u.full_name, u.current_streak, dal.activity_date as last_activity
      FROM users u
      LEFT JOIN daily_activity_log dal ON u.id = dal.user_id
      WHERE u.role = 'learner'
      AND dal.activity_date = (
        SELECT MAX(activity_date)
        FROM daily_activity_log
        WHERE user_id = u.id
      )
      AND dal.activity_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      AND dal.activity_date > DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      LIMIT 50
    `);

    for (const user of inactiveUsers) {
      try {
        const daysSince = Math.floor((new Date() - new Date(user.last_activity)) / (1000 * 60 * 60 * 24));

        await createNotification(
          user.id,
          'streak_at_risk', // Reusing type for now
          'We Miss You!',
          `It's been ${daysSince} days since your last lesson. Come back and continue your learning journey!`,
          null
        );
      } catch (error) {
        console.error(`Failed to re-engage user ${user.id}:`, error);
      }
    }

    console.log(`[CRON] Re-engagement notifications sent to ${inactiveUsers.length} inactive users`);
  } catch (error) {
    console.error('[CRON] Error in inactive user check:', error);
  }
};

/**
 * Initialize all cron jobs
 */
const initGamificationCronJobs = () => {
  console.log('[CRON] Initializing gamification cron jobs...');

  // Streak risk notifications - 6 PM UTC (afternoon reminder)
  cron.schedule('0 18 * * *', () => {
    checkStreaksAtRisk();
  });

  // Streak risk notifications - 11 PM UTC (evening reminder)
  cron.schedule('0 23 * * *', () => {
    checkStreaksAtRisk();
  });

  // Weekly cleanup - Sunday at 3 AM UTC
  cron.schedule('0 3 * * 0', () => {
    cleanupOldAuditLogs();
  });

  // Daily maintenance - Every day at 2 AM UTC
  cron.schedule('0 2 * * *', () => {
    dailyMaintenance();
  });

  // Refresh token cleanup - Every day at 3 AM UTC
  cron.schedule('0 3 * * *', () => {
    cleanupRefreshTokens();
  });

  // Weekly leaderboard snapshot - Monday at 1 AM UTC
  cron.schedule('0 1 * * 1', () => {
    weeklyLeaderboardSnapshot();
  });

  // Inactive user re-engagement - Every 3 days at 10 AM UTC
  cron.schedule('0 10 */3 * *', () => {
    checkInactiveUsers();
  });

  console.log('[CRON] Gamification cron jobs initialized successfully');
  console.log('[CRON] Scheduled tasks:');
  console.log('  - Streak risk check: Daily at 6 PM and 11 PM UTC');
  console.log('  - Audit log cleanup: Weekly on Sunday at 3 AM UTC');
  console.log('  - Daily maintenance: Daily at 2 AM UTC');
  console.log('  - Refresh token cleanup: Daily at 3 AM UTC');
  console.log('  - Leaderboard snapshot: Weekly on Monday at 1 AM UTC');
  console.log('  - Re-engagement check: Every 3 days at 10 AM UTC');
};

/**
 * Manual trigger functions (for testing or admin use)
 */
const manualTriggers = {
  checkStreaksAtRisk,
  cleanupOldAuditLogs,
  dailyMaintenance,
  cleanupRefreshTokens,
  weeklyLeaderboardSnapshot,
  checkInactiveUsers
};

module.exports = {
  initGamificationCronJobs,
  manualTriggers
};