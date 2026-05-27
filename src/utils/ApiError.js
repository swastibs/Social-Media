/**
 * Custom API Error Class
 *
 * Extends the native Error class to include an HTTP status code.
 * Used across controllers and middlewares for consistent error handling.
 * The global error handler (globalErrorHandeler.js) checks for instances
 * of this class to send appropriate responses.
 */

class ApiError extends Error {
  /**
   * Create a new API error
   * @param {number} statusCode - HTTP status code (e.g., 400, 401, 404, 500)
   * @param {string} message - Human-readable error message
   */
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    // Capture stack trace for debugging (optional)
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
