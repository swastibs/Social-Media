const ApiError = require("../utils/ApiError");

exports.globalErrorHandler = (err, req, res, next) => {
  console.dir(err, { depth: null });

  // Determine if this is an API request
  const isApi =
    req.originalUrl.startsWith("/api") ||
    req.xhr ||
    req.accepts("json") === "json";

  // Helper to render error page with main layout (for web)
  const renderErrorPage = (statusCode, title, message) => {
    res.status(statusCode).render("error", {
      title,
      message,
      user: req.user || null,
      layout: "layouts/main",
    });
  };

  // 1) Express Validation errors
  if (err.name === "ValidationError") {
    const message =
      err.details?.body?.[0]?.message ||
      err.details?.params?.[0]?.message ||
      err.details?.query?.[0]?.message ||
      "Validation failed";

    if (isApi) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message,
        errors: err.details || null,
      });
    }

    // Web: render error page with layout
    return renderErrorPage(400, "Validation Error", message);
  }

  // 2) Custom ApiError
  if (err instanceof ApiError) {
    if (isApi) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errors: err.errors || null,
      });
    }

    // Web: render error page with layout
    return renderErrorPage(err.statusCode, "Error", err.message);
  }

  // 3) Any other error (500)
  if (isApi) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

  // Web: render generic error page with layout
  return renderErrorPage(
    500,
    "Server Error",
    "Something went wrong. Please try again later.",
  );
};
