const ApiError = require("../utils/ApiError");

exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user)
        throw new ApiError(401, "Authentication required. Please log in.");

      if (!allowedRoles.length) return next();

      if (!allowedRoles.includes(user.role))
        throw new ApiError(
          403,
          "You do not have permission to access this resource.",
        );

      next();
    } catch (error) {
      next(error);
    }
  };
};
