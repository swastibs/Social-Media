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

// Support Upstash REST URL and token
const urlString = process.env.UPSTASH_REDIS_REST_URL;
if (!urlString) {
  console.warn("UPSTASH_REDIS_REST_URL not set; defaulting to localhost Redis");
}

let redis;
try {
  if (urlString) {
    const url = new URL(urlString);
    redis = new Redis({
      host: url.hostname,
      port: 6379,
      password: process.env.UPSTASH_REDIS_REST_TOKEN,
      tls: {},
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
  } else {
    redis = new Redis();
  }
} catch (err) {
  console.error("Failed to configure Redis client:", err.message || err);
  redis = new Redis();
}

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

module.exports = redis;
