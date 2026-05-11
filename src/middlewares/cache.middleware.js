const { successResponse } = require("../utils/ApiResponse");
const { generateCacheKey, getCache } = require("../utils/cache");

exports.cacheMiddleware = () => {
  return async (req, res, next) => {
    try {
      const key = generateCacheKey(req);

      const cachedData = await getCache(key);

      if (cachedData) {
        const message =
          (cachedData.message || "Data fetched successfully") + " (cached)";

        return successResponse(res, {
          statusCode: 200,
          message,
          data: cachedData.data,
          meta: cachedData.meta,
        });
      }

      req.cacheKey = key;

      next();
    } catch (err) {
      next(err);
    }
  };
};
