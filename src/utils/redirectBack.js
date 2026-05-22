function redirectBack(req, res, fallback = "/") {
  const referer = req.get("Referrer") || req.get("Referer");
  const host = req.get("host");
  const protocol = req.protocol;

  if (referer && referer.startsWith(`${protocol}://${host}`)) {
    return res.redirect(referer);
  }
  return res.redirect(fallback);
}

module.exports = redirectBack;
