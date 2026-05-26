/**
 * API Response Helper
 *
 * Provides a standardized way to send JSON responses.
 * Used for AJAX endpoints (comments, likes, follow, payment verification, etc.)
 * that expect JSON instead of full HTML rendering.
 */

/**
 * Sends a success JSON response.
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {number} options.statusCode - HTTP status code (default: 200)
 * @param {string} options.message - Success message
 * @param {any} options.data - Optional payload
 * @param {Object} options.meta - Optional metadata (pagination, etc.)
 */
exports.successResponse = (res, options = {}) => {
  const {
    statusCode = 200,
    message = "Success",
    data = null,
    ...extra
  } = options;

  const response = {
    success: true,
    message,
    ...extra,
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Sends an error JSON response.
 * Used mainly by the global error handler for API errors.
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} errors - Optional validation errors
 */
exports.errorResponse = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    message,
  };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};
