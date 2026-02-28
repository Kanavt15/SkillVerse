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

module.exports = { pool, testConnection };
