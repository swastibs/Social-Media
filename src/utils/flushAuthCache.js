/**
 * Flush Authentication Cache Utility
 *
 * Deletes all authentication-related keys from Redis:
 * - Blacklisted tokens (blacklist:token:*)
 * - User token sets (user:tokens:*)
 *
 * Used after seeding the database to force all existing sessions to expire.
 */

const redis = require("../config/redis");

/**
 * Scans Redis for keys matching a pattern and deletes them in batches.
 * @param {string} pattern - Redis key pattern
 * @returns {Promise<number>} - Number of deleted keys
 */
async function deleteKeysByPattern(pattern) {
  let cursor = "0";
  let deletedCount = 0;

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = nextCursor;

    if (keys.length) {
      await redis.del(...keys);
      deletedCount += keys.length;
    }
  } while (cursor !== "0");

  return deletedCount;
}

/**
 * Flushes all authentication tokens from Redis.
 * Deletes both blacklist entries and user token sets.
 */
async function flushAuthCache() {
  console.log("🔐 Flushing all authentication tokens from Redis...");

  try {
    // Delete blacklisted tokens
    const blacklistedDeleted = await deleteKeysByPattern("blacklist:token:*");

    // Delete user token sets
    const userTokensDeleted = await deleteKeysByPattern("user:tokens:*");

    const totalDeleted = blacklistedDeleted + userTokensDeleted;
    console.log(`✅ Removed ${totalDeleted} auth keys from Redis`);
  } catch (err) {
    console.error("❌ Failed to flush auth cache:", err.message);
  }
}

module.exports = flushAuthCache;
