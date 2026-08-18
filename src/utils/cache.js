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
    console.log(`📦 Cache stored: ${key} (TTL: ${ttl}s)`);
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
    console.log(`🗑️ Cache deleted: ${key}`);
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
    let deletedCount = 0;
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        SCAN_COUNT,
      );
      cursor = nextCursor;
      if (keys.length) {
        await redis.del(...keys);
        deletedCount += keys.length;
        console.log(`🗑️ Deleted ${keys.length} keys matching: ${pattern}`);
      }
    } while (cursor !== "0");
    if (deletedCount === 0) {
      console.log(`🔍 No keys found matching: ${pattern}`);
    }
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

/**
 * ============================================
 * ADVANCED CACHE INVALIDATION FUNCTIONS
 * ============================================
 */

/**
 * Invalidates multiple cache patterns at once
 * @param {string[]} patterns - Array of Redis key patterns
 */
exports.invalidateMultiple = async (patterns) => {
  const validPatterns = patterns.filter((p) => p && typeof p === "string");
  if (validPatterns.length === 0) return;

  const promises = validPatterns.map((pattern) =>
    exports.deleteByPattern(pattern),
  );
  await Promise.all(promises);
  console.log(`🗑️ Invalidated ${validPatterns.length} cache patterns`);
};

/**
 * Invalidates all API cache
 */
exports.invalidateAllApiCache = async () => {
  await exports.deleteByPattern("cache:/api/*");
  console.log("🗑️ All API cache invalidated");
};

/**
 * Invalidates all Web cache
 */
exports.invalidateAllWebCache = async () => {
  await exports.deleteByPattern("web:cache:*");
  console.log("🗑️ All Web cache invalidated");
};

/**
 * Invalidates all cache (API + Web)
 */
exports.invalidateAllCache = async () => {
  await Promise.all([
    exports.deleteByPattern("cache:/api/*"),
    exports.deleteByPattern("web:cache:*"),
  ]);
  console.log("🗑️ All cache (API + Web) invalidated");
};

/**
 * Invalidates cache for a specific user
 * @param {number} userId - User ID
 */
exports.invalidateUserCache = async (userId) => {
  await exports.invalidateMultiple([
    `cache:/api/users/${userId}*`,
    `cache:/api/users/${userId}/posts*`,
    `cache:/api/users/${userId}/followers*`,
    `cache:/api/users/${userId}/following*`,
    `cache:/api/users/${userId}/comments*`,
    `web:cache:/profile/${userId}*`,
    `web:cache:/profile/${userId}/followers*`,
    `web:cache:/profile/${userId}/following*`,
  ]);
  console.log(`🗑️ User ${userId} cache invalidated`);
};

/**
 * Invalidates cache for a specific post
 * @param {number} postId - Post ID
 * @param {number} userId - User ID (post owner)
 */
exports.invalidatePostCache = async (postId, userId) => {
  await exports.invalidateMultiple([
    `cache:/api/posts/${postId}`,
    `cache:/api/posts/${postId}/comments*`,
    `cache:/api/users/${userId}/posts*`,
    `web:cache:/post/${postId}*`,
    `web:cache:/profile/${userId}*`,
    `web:cache:/feed*`,
  ]);
  console.log(`🗑️ Post ${postId} cache invalidated`);
};

/**
 * Invalidates cache for a specific comment
 * @param {number} commentId - Comment ID
 * @param {number} postId - Post ID
 * @param {number} userId - User ID (comment author)
 */
exports.invalidateCommentCache = async (commentId, postId, userId) => {
  await exports.invalidateMultiple([
    `cache:/api/comments/${commentId}`,
    `cache:/api/comments*`,
    `cache:/api/posts/${postId}/comments*`,
    `cache:/api/users/${userId}/comments*`,
    `web:cache:/post/${postId}*`,
    `web:cache:/profile/${userId}*`,
    `web:cache:/feed*`,
  ]);
  console.log(`🗑️ Comment ${commentId} cache invalidated`);
};

/**
 * Invalidates feed cache for all users
 */
exports.invalidateFeedCache = async () => {
  await exports.deleteByPattern("web:cache:/feed*");
  await exports.deleteByPattern("cache:/api/posts*");
  console.log("🗑️ Feed cache invalidated");
};

/**
 * Invalidates search cache
 */
exports.invalidateSearchCache = async () => {
  await exports.deleteByPattern("web:cache:/search*");
  console.log("🗑️ Search cache invalidated");
};

/**
 * Invalidates follow requests cache for a user
 * @param {number} userId - User ID
 */
exports.invalidateFollowRequestsCache = async (userId) => {
  await exports.invalidateMultiple([
    `web:cache:/follow-requests*`,
    `web:cache:/profile/${userId}/followers*`,
    `web:cache:/profile/${userId}/following*`,
    `cache:/api/users/${userId}/followers*`,
    `cache:/api/users/${userId}/following*`,
  ]);
  console.log(`🗑️ Follow requests cache for user ${userId} invalidated`);
};

/**
 * Gets cache statistics (useful for debugging)
 */
exports.getCacheStats = async () => {
  try {
    const info = await redis.info("stats");
    const keyspace = await redis.info("keyspace");
    return { info, keyspace };
  } catch (err) {
    console.error("Cache stats error:", err);
    return null;
  }
};

/**
 * Clears cache by prefix (e.g., "cache:/api/users")
 * @param {string} prefix - Cache key prefix
 */
exports.clearCacheByPrefix = async (prefix) => {
  await exports.deleteByPattern(`${prefix}*`);
  console.log(`🗑️ All cache with prefix "${prefix}" invalidated`);
};

/**
 * Checks if a cache key exists
 * @param {string} key - Redis cache key
 * @returns {Promise<boolean>}
 */
exports.cacheExists = async (key) => {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (err) {
    console.error("Cache EXISTS error:", err);
    return false;
  }
};

/**
 * Gets TTL of a cache key in seconds
 * @param {string} key - Redis cache key
 * @returns {Promise<number>} - TTL in seconds (-2 if key doesn't exist, -1 if no expiry)
 */
exports.getCacheTTL = async (key) => {
  try {
    return await redis.ttl(key);
  } catch (err) {
    console.error("Cache TTL error:", err);
    return -2;
  }
};

// Add these functions to your existing cache.js file

/**
 * Invalidates comment cache
 * @param {number} commentId - Comment ID
 * @param {number} postId - Post ID
 * @param {number} userId - User ID
 */
exports.invalidateCommentCache = async (commentId, postId, userId) => {
  await exports.invalidateMultiple([
    `cache:/api/comments/${commentId}`,
    `cache:/api/comments*`,
    `cache:/api/posts/${postId}/comments*`,
    `cache:/api/users/${userId}/comments*`,
    `web:cache:/post/${postId}*`,
    `web:cache:/profile/${userId}*`,
    `web:cache:/feed*`,
  ]);
  console.log(`🗑️ Comment ${commentId} cache invalidated`);
};

/**
 * Invalidates follow cache
 * @param {number} followerId - Follower user ID
 * @param {number} followingId - Following user ID
 */
exports.invalidateFollowCache = async (followerId, followingId) => {
  await exports.invalidateMultiple([
    `cache:/api/users/${followerId}*`,
    `cache:/api/users/${followingId}*`,
    `cache:/api/users/${followerId}/followers*`,
    `cache:/api/users/${followerId}/following*`,
    `cache:/api/users/${followingId}/followers*`,
    `cache:/api/users/${followingId}/following*`,
    `web:cache:/profile/${followerId}*`,
    `web:cache:/profile/${followingId}*`,
    `web:cache:/profile/${followerId}/followers*`,
    `web:cache:/profile/${followerId}/following*`,
    `web:cache:/profile/${followingId}/followers*`,
    `web:cache:/profile/${followingId}/following*`,
  ]);
  console.log(
    `🗑️ Follow cache invalidated for ${followerId} -> ${followingId}`,
  );
};

/**
 * Invalidates feed cache
 */
exports.invalidateFeedCache = async () => {
  await exports.deleteByPattern("web:cache:/feed*");
  await exports.deleteByPattern("cache:/api/posts*");
  console.log("🗑️ Feed cache invalidated");
};

/**
 * Invalidates activity cache
 */
exports.invalidateActivityCache = async () => {
  await exports.deleteByPattern("cache:/api/activities*");
  console.log("🗑️ Activity cache invalidated");
};

// Invalidate feed cache for a user
exports.invalidateFeedCache = async (userId) => {
  await deleteByPattern(`cache:/api/posts/feed*`);
  // If you use cache key pattern like `cache:/api/posts/feed?userId=...`
  await deleteByPattern(`cache:/api/posts/feed?*`);
};
