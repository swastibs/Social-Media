const Redis = require("ioredis");

const isRemoteRedis =
  process.env.REDIS_HOST &&
  !/^(localhost|127\.0\.0\.1)$/i.test(process.env.REDIS_HOST);

const redisOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  username: process.env.REDIS_USERNAME || (isRemoteRedis ? "default" : undefined),
  password: process.env.REDIS_PASSWORD || undefined, // ← for ArcticKey
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    if (times > 10) {
      console.error("Redis: Max retries reached, giving up");
      return null;
    }
    return delay;
  },
};

if (process.env.REDIS_URL) {
  const redis = new Redis(process.env.REDIS_URL, redisOptions);

  redis.once("connect", () => console.log("✅ Redis connected"));
  redis.on("error", (err) => console.error("❌ Redis error:", err.message));

  module.exports = redis;
} else {
  if (process.env.REDIS_TLS === "true" || isRemoteRedis) {
    redisOptions.tls = {
      rejectUnauthorized: false,
      servername: process.env.REDIS_HOST,
    };
  }

  const redis = new Redis(redisOptions);

  redis.once("connect", () => console.log("✅ Redis connected"));
  redis.on("error", (err) => console.error("❌ Redis error:", err.message));

  module.exports = redis;
}
