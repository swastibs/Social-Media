/**
 * Authentication Middlewares
 *
 * isAuthenticated: Redirects to login if user not logged in.
 * redirectIfLoggedIn: Redirects to feed/admin if already logged in.
 */

const passport = require("passport");
const jwt = require("jsonwebtoken");
const { isTokenValid } = require("../utils/authCache");
const { User } = require("../models");

// Passport JWT authentication (for API-like endpoints)
exports.authenticate = passport.authenticate("jwt", { session: false });

// Web route authentication – redirects to login if not authenticated
exports.isAuthenticated = async (req, res, next) => {
  const token = req.cookies?.postloop_token;
  if (!token) {
    req.flash("error_msg", "Please log in to access this page");
    return res.redirect("/login");
  }

  const isValid = await isTokenValid(token);
  if (!isValid) {
    req.flash("error_msg", "Session expired. Please log in again");
    return res.redirect("/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user || user.isDeleted || !user.isActive) {
      req.flash("error_msg", "Please log in to access this page");
      return res.redirect("/login");
    }
    req.user = user;
    next();
  } catch (err) {
    req.flash("error_msg", "Invalid session. Please log in again");
    res.redirect("/login");
  }
};

// Redirect if already logged in (for login/signup pages)
exports.redirectIfLoggedIn = async (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  const token = req.cookies?.postloop_token;
  if (!token) return next();

  const isValid = await isTokenValid(token);
  if (!isValid) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (user && !user.isDeleted && user.isActive) {
      return res.redirect(user.role === "admin" ? "/admin/dashboard" : "/feed");
    }
    next();
  } catch (err) {
    next();
  }
};
