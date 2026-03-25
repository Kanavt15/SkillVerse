const Redis = require('ioredis');

let redisClient = null;
let isRedisConnected = false;

// Configuration from environment
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'skillverse:',
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      console.warn('⚠️ Redis: Max retries exceeded, giving up');
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000); // Exponential backoff
  }
};

/**
 * Initialize Redis connection
 * @returns {Promise<Redis|null>}
 */
async function initRedis() {
  if (redisClient && isRedisConnected) return redisClient;

  return new Promise((resolve) => {
    try {
      redisClient = new Redis(REDIS_CONFIG);

      redisClient.on('connect', () => {
        console.log('🔴 Redis: Connecting...');
      });

      redisClient.on('ready', () => {
        isRedisConnected = true;
        console.log('✅ Redis: Connected and ready');
        resolve(redisClient);
      });

      redisClient.on('error', (err) => {
        if (isRedisConnected) {
          console.error('❌ Redis connection error:', err.message);
        }
        isRedisConnected = false;
      });

      redisClient.on('close', () => {
        isRedisConnected = false;
        console.log('🔴 Redis: Connection closed');
      });

      // Timeout if connection takes too long
      setTimeout(() => {
        if (!isRedisConnected) {
          console.warn('⚠️ Redis: Connection timeout, continuing without cache');
          resolve(null);
        }
      }, 5000);

    } catch (error) {
      console.warn('⚠️ Redis unavailable, falling back to no-cache mode:', error.message);
      redisClient = null;
      resolve(null);
    }
  });
}

/**
 * Get Redis client (returns null if unavailable)
 * @returns {Redis|null}
 */
function getRedisClient() {
  return isRedisConnected ? redisClient : null;
}

/**
 * Check if Redis is available
 * @returns {boolean}
 */
function isRedisAvailable() {
  return isRedisConnected && redisClient !== null;
}

/**
 * Graceful shutdown
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isRedisConnected = false;
    console.log('🔴 Redis: Disconnected gracefully');
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  isRedisAvailable,
  closeRedis,
  REDIS_CONFIG
};
