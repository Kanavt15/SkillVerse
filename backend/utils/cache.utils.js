const { getRedisClient, isRedisAvailable } = require('../config/redis');

/**
 * Get cached value by key
 * @param {string} key - Cache key (prefix auto-added by ioredis)
 * @returns {Promise<any|null>} - Parsed value or null
 */
async function cacheGet(key) {
  if (!isRedisAvailable()) return null;

  try {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`[Cache] GET error for "${key}":`, error.message);
    return null;
  }
}

/**
 * Set cached value with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttlSeconds - Time to live in seconds
 * @returns {Promise<boolean>} - Success status
 */
async function cacheSet(key, value, ttlSeconds) {
  if (!isRedisAvailable()) return false;

  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    await client.setex(key, ttlSeconds, serialized);
    return true;
  } catch (error) {
    console.error(`[Cache] SET error for "${key}":`, error.message);
    return false;
  }
}

/**
 * Delete cached value by key
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Success status
 */
async function cacheDel(key) {
  if (!isRedisAvailable()) return false;

  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    console.error(`[Cache] DEL error for "${key}":`, error.message);
    return false;
  }
}

/**
 * Delete all keys matching a pattern using SCAN (memory-safe)
 * @param {string} pattern - Glob pattern (e.g., "courses:list:*")
 * @returns {Promise<number>} - Number of deleted keys
 */
async function cacheDelPattern(pattern) {
  if (!isRedisAvailable()) return 0;

  try {
    const client = getRedisClient();
    const prefix = client.options.keyPrefix || '';
    const fullPattern = prefix + pattern;

    let deletedCount = 0;
    let cursor = '0';

    do {
      // SCAN is non-blocking unlike KEYS
      const [newCursor, keys] = await client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
      cursor = newCursor;

      if (keys.length > 0) {
        // Remove prefix for DEL command (ioredis adds it automatically)
        const keysWithoutPrefix = keys.map(k => k.replace(prefix, ''));
        await client.del(...keysWithoutPrefix);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    if (deletedCount > 0) {
      console.log(`[Cache] Deleted ${deletedCount} keys matching "${pattern}"`);
    }

    return deletedCount;
  } catch (error) {
    console.error(`[Cache] DEL PATTERN error for "${pattern}":`, error.message);
    return 0;
  }
}

/**
 * Get or set cache (cache-aside pattern)
 * @param {string} key - Cache key
 * @param {number} ttlSeconds - TTL for cached value
 * @param {Function} fetchFn - Async function to call if cache miss
 * @returns {Promise<{data: any, fromCache: boolean}>}
 */
async function cacheGetOrSet(key, ttlSeconds, fetchFn) {
  // Try cache first
  const cached = await cacheGet(key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  // Cache miss - fetch fresh data
  const freshData = await fetchFn();

  // Store in cache (fire and forget)
  cacheSet(key, freshData, ttlSeconds).catch(() => {});

  return { data: freshData, fromCache: false };
}

// Cache key builders (ensures consistent key formats)
const CacheKeys = {
  // Course listings: courses:list:{sortBy}:{categoryId}:{page}:{limit}
  courseList: (sortBy, categoryId, page, limit) =>
    `courses:list:${sortBy || 'newest'}:${categoryId || 'all'}:${page}:${limit}`,

  // Single course: courses:detail:{id}
  courseDetail: (courseId) => `courses:detail:${courseId}`,

  // Instructor stats: instructor:stats:{userId}
  instructorStats: (userId) => `instructor:stats:${userId}`,

  // Patterns for bulk invalidation
  patterns: {
    allCourseLists: 'courses:list:*',
    allCourseDetails: 'courses:detail:*',
    instructorStats: (userId) => `instructor:stats:${userId}`
  }
};

// TTL constants (in seconds)
const CacheTTL = {
  COURSE_LIST: 5 * 60,       // 5 minutes
  COURSE_DETAIL: 10 * 60,    // 10 minutes
  INSTRUCTOR_STATS: 10 * 60  // 10 minutes
};

module.exports = {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  cacheGetOrSet,
  CacheKeys,
  CacheTTL
};
