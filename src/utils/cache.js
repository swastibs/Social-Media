/**
 * Cache Utilities (Redis)
 *
 * Provides helper functions for caching data in Redis.
 * Used primarily for HTML page caching (webCache middleware)
 * and for API-like JSON caching (still used by some internal AJAX endpoints).
 */

const redis = require("../config/redis");
const DEFAULT_TTL = 60 * 5; // 5 minutes default TTL
const SCAN_COUNT = parseInt(process.env.REDIS_SCAN_COUNT || "100", 10);

/**
 * Retrieves cached data by key.
 * @param {string} key - Redis cache key
 * @returns {Promise<any|null>} - Parsed JSON or null if not found/error
 */
exports.getCache = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("Cache GET error:", err);
    return null;
  }
};

/**
 * Stores data in Redis with optional TTL.
 * @param {string} key - Redis cache key
 * @param {any} value - Value to store (will be JSON.stringify'd)
 * @param {number} ttl - Time to live in seconds (default: 300)
 */
exports.setCache = async (key, value, ttl = DEFAULT_TTL) => {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch (err) {
    console.error("Cache SET error:", err);
  }
};

/**
 * Deletes a single cache key.
 * @param {string} key - Redis cache key
 */
exports.deleteCache = async (key) => {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("Cache DELETE error:", err);
  }
};

/**
 * Deletes all keys matching a pattern using SCAN (non-blocking).
 * @param {string} pattern - Redis key pattern (e.g., "web:cache:/feed*")
 */
exports.deleteByPattern = async (pattern) => {
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        SCAN_COUNT,
      );
      cursor = nextCursor;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    console.error("Cache PATTERN DELETE error:", err);
  }
};

/**
 * Generates a consistent cache key from the request.
 * Used by cache middleware to create deterministic keys.
 * @param {Object} req - Express request object
 * @returns {string} - Cache key (e.g., "cache:/feed?page=2")
 */
exports.generateCacheKey = (req) => {
  let key = req.originalUrl;
  // Remove trailing slash for consistency
  if (key.endsWith("/")) key = key.slice(0, -1);
  return `cache:${key}`;
};
