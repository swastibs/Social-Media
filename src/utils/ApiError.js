/**
 * Custom error class for API responses.
 * Extends the built-in Error and adds an HTTP status code.
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    // Capture stack trace for debugging (optional)
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
