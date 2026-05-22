const redis = require("../config/redis");

async function flushAuthCache() {
  console.log("🔐 Flushing all authentication tokens from Redis...");
  let cursor = "0";
  let deletedCount = 0;

  // Delete blacklisted tokens
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      "blacklist:token:*",
      "COUNT",
      100,
    );
    cursor = nextCursor;
    if (keys.length) {
      await redis.del(...keys);
      deletedCount += keys.length;
    }
  } while (cursor !== "0");

  // Delete user token sets
  cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      "user:tokens:*",
      "COUNT",
      100,
    );
    cursor = nextCursor;
    if (keys.length) {
      await redis.del(...keys);
      deletedCount += keys.length;
    }
  } while (cursor !== "0");

  console.log(`✅ Removed ${deletedCount} auth keys from Redis`);
}

module.exports = flushAuthCache;
