const ApiError = require("../utils/ApiError");

exports.globalErrorHandler = (err, req, res, next) => {
  console.dir(err, { depth: null });

  if (err.name === "ValidationError") {
    const message =
      err.details?.body?.[0]?.message ||
      err.details?.params?.[0]?.message ||
      err.details?.query?.[0]?.message ||
      "Validation failed";

    return res.status(err.statusCode || 400).json({
      success: false,
      message,
      errors: err.details || null,
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || null,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
