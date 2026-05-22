const jwt = require("jsonwebtoken");
const { isTokenValid } = require("../utils/authCache");
const { User } = require("../models");

/**
 * Middleware that attaches `req.user` if a valid token is present in cookies.
 * Unlike `isAuthenticated`, it never redirects or throws errors.
 * It simply sets `req.user` to the user object or null.
 */
const attachUserIfLoggedIn = async (req, res, next) => {
  const token = req.cookies?.postloop_token;
  if (!token) {
    req.user = null;
    return next();
  }

  const isValid = await isTokenValid(token);
  if (!isValid) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user || user.isDeleted || !user.isActive) {
      req.user = null;
    } else {
      req.user = user;
    }
  } catch (err) {
    req.user = null;
  }
  next();
};

module.exports = attachUserIfLoggedIn;
