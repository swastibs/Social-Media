const redis = require("../config/redis");
const DEFAULT_TTL = 60 * 5;
const SCAN_COUNT = parseInt(process.env.REDIS_SCAN_COUNT || "100", 10);

exports.getCache = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("Cache GET error:", err);
    return null;
  }
};

exports.setCache = async (key, value, ttl = DEFAULT_TTL) => {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
    console.log(`📦 Cache stored: ${key} (TTL: ${ttl}s)`);
  } catch (err) {
    console.error("Cache SET error:", err);
  }
};

exports.deleteCache = async (key) => {
  try {
    await redis.del(key);
    console.log(`🗑️ Cache deleted: ${key}`);
  } catch (err) {
    console.error("Cache DELETE error:", err);
  }
};

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

exports.generateCacheKey = (req) => {
  let key = req.originalUrl;

  if (key.endsWith("/")) key = key.slice(0, -1);
  return `cache:${key}`;
};

exports.invalidateMultiple = async (patterns) => {
  const validPatterns = patterns.filter((p) => p && typeof p === "string");
  if (validPatterns.length === 0) return;

  const promises = validPatterns.map((pattern) =>
    exports.deleteByPattern(pattern),
  );
  await Promise.all(promises);
  console.log(`🗑️ Invalidated ${validPatterns.length} cache patterns`);
};

exports.invalidateAllApiCache = async () => {
  await exports.deleteByPattern("cache:/api/*");
  console.log("🗑️ All API cache invalidated");
};

exports.invalidateAllWebCache = async () => {
  await exports.deleteByPattern("web:cache:*");
  console.log("🗑️ All Web cache invalidated");
};

exports.invalidateAllCache = async () => {
  await Promise.all([
    exports.deleteByPattern("cache:/api/*"),
    exports.deleteByPattern("web:cache:*"),
  ]);
  console.log("🗑️ All cache (API + Web) invalidated");
};

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

exports.invalidateFeedCache = async () => {
  await exports.deleteByPattern("web:cache:/feed*");
  await exports.deleteByPattern("cache:/api/posts*");
  console.log("🗑️ Feed cache invalidated");
};

exports.invalidateSearchCache = async () => {
  await exports.deleteByPattern("web:cache:/search*");
  console.log("🗑️ Search cache invalidated");
};

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

exports.clearCacheByPrefix = async (prefix) => {
  await exports.deleteByPattern(`${prefix}*`);
  console.log(`🗑️ All cache with prefix "${prefix}" invalidated`);
};

exports.cacheExists = async (key) => {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (err) {
    console.error("Cache EXISTS error:", err);
    return false;
  }
};

exports.getCacheTTL = async (key) => {
  try {
    return await redis.ttl(key);
  } catch (err) {
    console.error("Cache TTL error:", err);
    return -2;
  }
};

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

exports.invalidateFeedCache = async () => {
  await exports.deleteByPattern("web:cache:/feed*");
  await exports.deleteByPattern("cache:/api/posts*");
  console.log("🗑️ Feed cache invalidated");
};

exports.invalidateActivityCache = async () => {
  await exports.deleteByPattern("cache:/api/activities*");
  console.log("🗑️ Activity cache invalidated");
};

exports.invalidateFeedCache = async (userId) => {
  await deleteByPattern(`cache:/api/posts/feed*`);

  await deleteByPattern(`cache:/api/posts/feed?*`);
};
