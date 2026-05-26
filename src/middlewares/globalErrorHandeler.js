/**
 * Global Error Handler
 *
 * Catches all errors, distinguishes between API (JSON) and web (HTML) responses.
 * Handles validation errors, custom ApiErrors, and unexpected errors.
 */

const ApiError = require("../utils/ApiError");
const multer = require("multer");

exports.globalErrorHandler = (err, req, res, next) => {
  const isApi =
    req.originalUrl.startsWith("/api") ||
    req.xhr === true ||
    req.get("Accept")?.includes("application/json") === true;

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

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must be 2MB or smaller"
        : err.message || "Invalid upload";

    if (isApi) {
      return res.status(422).json({
        success: false,
        message,
      });
    }
    if (req.headers.referer) {
      req.flash("error_msg", message);
      if (req.body) req.flash("oldInput", req.body);
      return res.redirect("back");
    }
    return renderWebError(422, "Upload Error", message);
  }

  // Validation errors from express-validation
  if (err.name === "ValidationError") {
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

    if (req.headers.referer) {
      req.flash("error_msg", firstError);
      if (req.body) req.flash("oldInput", req.body);
      return res.redirect("back");
    }
    return renderWebError(400, "Validation Error", firstError);
  }

  // Custom ApiError
  if (err instanceof ApiError) {
    if (isApi) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    if (err.statusCode >= 400 && err.statusCode < 500 && req.headers.referer) {
      req.flash("error_msg", err.message);
      return res.redirect("back");
    }
    return renderWebError(err.statusCode, "Error", err.message);
  }

  // Unexpected errors (500)
  console.error("Unhandled error:", err);
  if (isApi) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

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
