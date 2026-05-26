/**
 * Redirect Back Helper
 *
 * Safely redirects to the previous page (HTTP Referer) or a fallback URL.
 * Prevents open redirect vulnerabilities by validating the referer domain.
 */

/**
 * Redirects to the previous page if the referer is from the same origin,
 * otherwise falls back to the provided default URL.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} fallback - Default URL if no safe referer exists (default: '/')
 */
function redirectBack(req, res, fallback = "/") {
  const referer = req.get("Referrer") || req.get("Referer");
  const host = req.get("host");
  const protocol = req.protocol;

  // Only redirect to referer if it's from the same application origin
  if (referer && referer.startsWith(`${protocol}://${host}`)) {
    return res.redirect(referer);
  }
  return res.redirect(fallback);
}

module.exports = redirectBack;
