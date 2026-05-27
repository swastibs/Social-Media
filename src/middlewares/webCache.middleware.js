/**
 * Web Cache Middleware
 *
 * Caches fully rendered HTML pages in Redis.
 * Uses a key based on URL + user ID to respect authentication state.
 */

const { getCache, setCache, generateCacheKey } = require("../utils/cache");

const WEB_PREFIX = "web:";
const DEFAULT_TTL = 60 * 60; // 1 hour

module.exports = (ttl = DEFAULT_TTL) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    const userId = req.user?.id || "guest";
    let originalUrl = req.originalUrl;
    if (originalUrl.endsWith("/")) originalUrl = originalUrl.slice(0, -1);
    const keyBase = `${originalUrl}|user:${userId}`;
    const cacheKey = `${WEB_PREFIX}${generateCacheKey({
      originalUrl: keyBase,
    })}`;

    try {
      const cachedHtml = await getCache(cacheKey);
      if (cachedHtml) {
        res.setHeader("X-Cache", "HIT");
        return res.send(cachedHtml);
      }

      res.setHeader("X-Cache", "MISS");

      const originalSend = res.send;
      let capturedHtml = null;

      res.send = function (body) {
        if (typeof body === "string" && res.statusCode === 200)
          capturedHtml = body;

        return originalSend.call(this, body);
      };

      res.once("finish", () => {
        if (capturedHtml && res.statusCode === 200)
          setCache(cacheKey, capturedHtml, ttl).catch(() => {});

        res.send = originalSend;
      });

      next();
    } catch (err) {
      next(err);
    }
  };
};
