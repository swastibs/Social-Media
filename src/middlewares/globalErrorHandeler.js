const ApiError = require("../utils/ApiError");

exports.globalErrorHandler = (err, req, res, next) => {
  console.dir(err, { depth: null });

  const isApi =
    req.originalUrl.startsWith("/api") ||
    req.xhr ||
    req.accepts("json") === "json";

  // Handle express-validation errors
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
    } else {
      // Store the error in flash and redirect back
      req.flash("error_msg", message);
      // Also store the old input if it's a POST request (body data)
      if (req.method === "POST" && req.body) {
        req.flash("oldInput", req.body);
      }
      return res.redirect("back");
    }
  }

  // Handle custom ApiError
  if (err instanceof ApiError) {
    if (isApi) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errors: err.errors || null,
      });
    } else {
      req.flash("error_msg", err.message);
      return res.redirect("back");
    }
  }

  // Handle all other errors (500)
  if (isApi) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } else {
    req.flash("error_msg", "Something went wrong. Please try again later.");
    return res.redirect("/");
  }
};
