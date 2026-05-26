/**
 * Cache Invalidation Middleware
 *
 * Deletes Redis cache keys matching provided patterns after the response is sent.
 * Used for mutations (POST, PUT, DELETE) to clear related cached pages.
 */

const { deleteByPattern } = require("../utils/cache");

/**
 * Creates middleware that invalidates cache patterns after response finishes.
 * @param {string[]} patterns - Array of Redis key patterns to delete (e.g., ["web:cache:/feed*"])
 * @returns {Function} Express middleware
 */
exports.invalidateCache = (patterns = []) => {
  return async (req, res, next) => {
    try {
      // Attach a listener to invalidate cache after response is sent
      res.on("finish", async () => {
        // Only invalidate on successful mutations (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          for (const pattern of patterns) {
            await deleteByPattern(pattern);
          }
        }
      });
      next();
    } catch (err) {
      // Fail silently – cache invalidation should not break the request
      next();
    }
  };
};
