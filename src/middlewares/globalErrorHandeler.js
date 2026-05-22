const ApiError = require("../utils/ApiError");

/**
 * Global error handler – one handler for all errors (API & web)
 */
exports.globalErrorHandler = (err, req, res, next) => {
  // Determine if the client expects JSON
  // For web: we treat only explicit API routes or XHR as JSON.
  // Also if the request has a specific header "X-Requested-With" or "Accept: application/json"
  // But to avoid false positives for normal form POSTs, we be strict.
  const isApi =
    req.originalUrl.startsWith("/api") ||
    req.xhr === true ||
    req.get("Accept")?.includes("application/json") === true;

  // Helper: render web error page with a layout
  const renderWebError = (statusCode, title, message, redirectBack = false) => {
    if (redirectBack && req.headers.referer) {
      req.flash("error_msg", message);
      return res.redirect("back");
    }
    res.status(statusCode).render("error", {
      title,
      message,
      user: req.user || null,
      layout: "layouts/main",
    });
  };

  // 1) Validation errors from express-validation
  if (err.name === "ValidationError") {
    // Extract first meaningful error message
    const details = err.details || {};
    const firstError =
      details.body?.[0]?.message ||
      details.params?.[0]?.message ||
      details.query?.[0]?.message ||
      "Validation failed";

    if (isApi) {
      return res.status(400).json({
        success: false,
        message: firstError,
        errors: err.details || null,
      });
    }

    // Web: flash the error and redirect back to the form (if possible)
    if (req.headers.referer) {
      req.flash("error_msg", firstError);
      // Preserve old input if needed (the validation middleware already does not populate, but we can add)
      if (req.body) req.flash("oldInput", req.body);
      return res.redirect("back");
    }
    // Fallback – render error page
    return renderWebError(400, "Validation Error", firstError);
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
    // For web, if it's a client error (4xx), flash and redirect back
    if (err.statusCode >= 400 && err.statusCode < 500 && req.headers.referer) {
      req.flash("error_msg", err.message);
      return res.redirect("back");
    }
    // Otherwise show error page
    return renderWebError(err.statusCode, "Error", err.message);
  }

  // 3) Any other unexpected error (500)
  console.error("Unhandled error:", err);
  if (isApi) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

  // Web: redirect to a generic error page or back with flash
  if (req.headers.referer) {
    req.flash("error_msg", "Something went wrong. Please try again.");
    return res.redirect("back");
  }
  return renderWebError(
    500,
    "Server Error",
    "Something went wrong. Please try again later.",
  );
};
