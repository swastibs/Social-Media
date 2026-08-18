const redis = require("../config/redis");

const rateLimiter = (windowSeconds, maxRequests, prefix = "rate") => {
  return async (req, res, next) => {
    const clientId = req.user?.id || req.ip || req.connection.remoteAddress;
    const key = `${prefix}:${clientId}`;

    try {
      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= maxRequests) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : windowSeconds;
        res.setHeader("Retry-After", retryAfter);

        if (req.accepts("json"))
          return res.status(429).json({
            success: false,
            message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          });
        else {
          req.flash(
            "error_msg",
            `Too many attempts. Please wait ${retryAfter} seconds.`,
          );
          return res.redirect("back");
        }
      }

      if (count === 0) await redis.set(key, 1, "EX", windowSeconds);
      else await redis.incr(key);

      const remaining = maxRequests - (count + 1);
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader(
        "X-RateLimit-Reset",
        Math.floor(Date.now() / 1000) + windowSeconds,
      );

      next();
    } catch (err) {
      console.error("Rate limiter error:", err);
      next();
    }
  };
};

module.exports = rateLimiter;
