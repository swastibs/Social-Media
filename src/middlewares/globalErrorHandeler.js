const ApiError = require("../utils/ApiError");

exports.globalErrorHandler = (err, req, res, next) => {
  console.dir(err, { depth: null });

  const isApi = req.originalUrl.startsWith("/api") || req.xhr || req.accepts("json") === "json";

  // Handle express-validation errors
  if (err.name === "ValidationError") {
    const message =
      err.details?.body?.[0]?.message ||
      err.details?.params?.[0]?.message ||
      err.details?.query?.[0]?.message ||
      "Validation failed";

    if (isApi)
      return res.status(err.statusCode || 400).json({
        success: false,
        message,
        errors: err.details || null,
      });
    else
      // For web: render an error page
      return res.status(400).render("error", {
        message,
        error: err,
        title: "Validation Error",
      });

  }

  // Handle custom ApiError
  if (err instanceof ApiError) {
    if (isApi)
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errors: err.errors || null,
      });
    else
      return res.status(err.statusCode).render("error", {
        message: err.message,
        error: err,
        title: "Error",
      });
  }

  // Handle all other errors (500)
  if (isApi)
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  else
    return res.status(500).render("error", {
      message: "Something went wrong. Please try again later.",
      error: err,
      title: "Server Error",
    });
};