const { deleteByPattern } = require("../utils/cache");

exports.invalidateCache = (patterns = []) => {
  return async (req, res, next) => {
    try {
      res.on("finish", async () => {
        for (const pattern of patterns) {
          await deleteByPattern(pattern);
        }
      });

      next();
    } catch (err) {
      next(err);
    }
  };
};
