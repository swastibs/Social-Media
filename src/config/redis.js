/**
 * Redis Configuration
 *
 * Sets up the Redis client for caching and authentication token storage.
 * Used for:
 * - HTML page caching (webCache middleware)
 * - JWT token blacklist / session invalidation
 * - Rate limiting counters
 */

const Redis = require("ioredis");

// Create Redis client with configuration from .env
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  // Optional: add password if set in .env
  // password: process.env.REDIS_PASSWORD || undefined,
  // Optional: database index (default 0)
  // db: 0,
  retryStrategy: (times) => {
    // Reconnect after 3 seconds, but stop after 10 attempts
    const delay = Math.min(times * 100, 3000);
    if (times > 10) {
      console.error("Redis: Max retries reached, giving up");
      return null;
    }
    return delay;
  },
});

// Event handlers
redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

module.exports = redis;
