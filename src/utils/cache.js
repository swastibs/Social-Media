const redis = require("../config/redis");
const DEFAULT_TTL = 60 * 5;

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
  } catch (err) {
    console.error("Cache SET error:", err);
  }
};

exports.deleteCache = async (key) => {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("Cache DELETE error:", err);
  }
};

exports.deleteByPattern = async (pattern) => {
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );

      cursor = nextCursor;

      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    console.error("Cache PATTERN DELETE error:", err);
  }
};

exports.generateCacheKey = (req) => {
  let key = req.originalUrl;

  if (key.endsWith("/")) key = key.slice(0, -1);

  return `cache:${key}`;
};
