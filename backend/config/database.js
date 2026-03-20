const mysql = require('mysql2/promise');
require('dotenv').config();

// SSL configuration for production
const sslConfig = process.env.DB_SSL === 'true' ? {
  ssl: {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  }
} : {};

// Create connection pool with hardened settings
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,       // 10s connection timeout
  decimalNumbers: true,         // Prevent precision issues with DECIMAL columns
  enableKeepAlive: true,        // Keep connections alive
  keepAliveInitialDelay: 30000, // 30s keep-alive delay
  ...sslConfig
});

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    console.log(`🔒 SSL: ${process.env.DB_SSL === 'true' ? 'Enabled' : 'Disabled (set DB_SSL=true for production)'}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Auto-create missing tables and columns (safe migrations)
const runMigrations = async () => {
  try {
    // 1. activity_audit_log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_audit_log (
        id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id       INT NOT NULL,
        action_type   VARCHAR(50) NOT NULL,
        entity_type   VARCHAR(50),
        entity_id     VARCHAR(100),
        ip_address    VARCHAR(45),
        user_agent    TEXT,
        metadata      JSON,
        is_suspicious TINYINT(1) DEFAULT 0,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_action (user_id, action_type),
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 2. Add gamification columns to users table (safe — IF NOT EXISTS not supported for columns, use ALTER IGNORE)
    const gamificationColumns = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INT UNSIGNED DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS level INT UNSIGNED DEFAULT 1`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INT UNSIGNED DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INT UNSIGNED DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_last_activity_date DATE DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freeze_count INT UNSIGNED DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'UTC'`,
    ];

    for (const sql of gamificationColumns) {
      try { await pool.query(sql); } catch (e) {
        // Column may already exist — ignore duplicate column errors
        if (!e.message.includes('Duplicate column')) console.error('⚠️ Column migration:', e.message);
      }
    }

    // 3. xp_transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS xp_transactions (
        id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id        INT NOT NULL,
        amount         INT NOT NULL,
        event_type     VARCHAR(50) NOT NULL,
        description    VARCHAR(255),
        reference_id   INT DEFAULT NULL,
        reference_type VARCHAR(50) DEFAULT NULL,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_event (event_type),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 4. daily_activity_log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_activity_log (
        id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id            INT NOT NULL,
        activity_date      DATE NOT NULL,
        lessons_completed  INT UNSIGNED DEFAULT 0,
        xp_earned         INT UNSIGNED DEFAULT 0,
        streak_maintained  TINYINT(1) DEFAULT 0,
        created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_date (user_id, activity_date),
        INDEX idx_user (user_id),
        INDEX idx_date (activity_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 5. streak_freezes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streak_freezes (
        id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        freeze_date DATE NOT NULL,
        reason      VARCHAR(100) DEFAULT 'purchased',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 6. user_badges table (for badge.service)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        badge_id   VARCHAR(100) NOT NULL,
        name       VARCHAR(100) NOT NULL,
        tier       VARCHAR(20) DEFAULT 'bronze',
        xp_reward  INT DEFAULT 0,
        awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_badge (user_id, badge_id),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✅ Migrations: All gamification tables and columns ready');
  } catch (err) {
    console.error('⚠️  Migration warning:', err.message);
    // Non-fatal — app continues
  }
};


module.exports = { pool, testConnection, runMigrations };

