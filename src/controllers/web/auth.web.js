/**
 * Authentication Controller (Web)
 *
 * Handles:
 * - Landing page (login/signup tabs)
 * - Login / Signup forms with flash messages
 * - Logout (clears JWT cookie and Redis session)
 * - Password change (with old password verification)
 */

const { User } = require("../../models");
const { compare, hash } = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  storeToken,
  deleteToken,
  deleteAllUserTokens,
  removeTokenFromUser,
} = require("../../utils/authCache");
const { uploadToMinio } = require("../../config/minio");
const { deleteByPattern } = require("../../utils/cache");

// ========== Landing & Tab Switching ==========
exports.landing = (req, res) => {
  if (req.user)
    return res.redirect(
      req.user.role === "admin" ? "/admin/dashboard" : "/feed",
    );

  res.render("landing", {
    mode: "login",
    oldInput: {},
    pageCss: "landing.css",
  });
};

exports.loginForm = (req, res) => {
  if (req.user)
    return res.redirect(
      req.user.role === "admin" ? "/admin/dashboard" : "/feed",
    );

  res.render("landing", {
    mode: "login",
    oldInput: req.flash("oldInput")[0] || {},
    pageCss: "landing.css",
  });
};

exports.signupForm = (req, res) => {
  if (req.user)
    return res.redirect(
      req.user.role === "admin" ? "/admin/dashboard" : "/feed",
    );

  res.render("landing", {
    mode: "signup",
    oldInput: req.flash("oldInput")[0] || {},
    pageCss: "landing.css",
  });
};

// ========== Login ==========
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email, isDeleted: false } });

    if (!user || !user.isActive) {
      req.flash("error_msg", "Invalid credentials");
      req.flash("oldInput", { email });
      return res.redirect("/login");
    }

    // GitHub-only accounts cannot use email/password
    if (!user.password) {
      req.flash(
        "error_msg",
        "This account uses GitHub login. Please sign in with GitHub.",
      );
      req.flash("oldInput", { email });
      return res.redirect("/login");
    }

    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      req.flash("error_msg", "Invalid credentials");
      req.flash("oldInput", { email });
      return res.redirect("/login");
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );
    await storeToken(token, user.id);
    res.cookie("postloop_token", token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    if (user.role === "admin") return res.redirect("/admin/dashboard");
    return res.redirect("/feed");
  } catch (err) {
    next(err);
  }
};

// ========== Signup ==========
exports.signup = async (req, res, next) => {
  try {
    const { name, email, password, bio } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      req.flash("error_msg", "Email already registered");
      req.flash("oldInput", { name, email, bio });
      return res.redirect("/signup");
    }

    const hashed = await hash(password, 10);
    let profilePictureUrl = null,
      thumbnailUrl = null;

    if (req.file) {
      const result = await uploadToMinio(
        req.file.buffer,
        req.file.originalname,
        "profiles",
        { thumbnailSize: 80 },
      );
      profilePictureUrl = result.url;
      thumbnailUrl = result.thumbnailUrl;
    }

    const newUser = await User.create({
      name,
      email,
      password: hashed,
      bio: bio || null,
      profilePictureUrl,
      thumbnailUrl,
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
    });

    await deleteByPattern(`web:cache:/profile/${newUser.id}*`);

    req.flash("success_msg", "Account created! Please log in.");
    res.redirect("/login");
  } catch (err) {
    next(err);
  }
};

// ========== Logout ==========
exports.logout = async (req, res) => {
  const token = req.cookies.postloop_token;
  const userId = req.user?.id;

  if (token) {
    await deleteToken(token);
    if (userId) await removeTokenFromUser(userId, token);
  }

  res.clearCookie("postloop_token", { path: "/" });

  req.flash("success_msg", "You have been logged out.");
  res.redirect("/");
};

// ========== Change Password ==========
exports.changePasswordForm = (req, res) => {
  res.render("auth/change-password", {
    title: "Change Password",
    user: req.user,
    error: null,
    oldInput: {},
    pageCss: "auth.css",
  });
};

exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      req.flash("error_msg", "User not found");
      return res.redirect("/change-password");
    }

    if (!user.password) {
      req.flash(
        "error_msg",
        "GitHub‑linked accounts cannot change password. Please use GitHub login.",
      );
      return res.redirect("/change-password");
    }

    const isMatch = await compare(oldPassword, user.password);
    if (!isMatch) {
      req.flash("error_msg", "Old password is incorrect");
      req.flash("oldInput", { oldPassword: req.body.oldPassword });
      return res.redirect("/change-password");
    }

    const hashedPassword = await hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await deleteByPattern(`web:cache:/profile/${userId}*`);
    await deleteByPattern("web:cache:/feed*");

    await deleteAllUserTokens(userId);
    res.clearCookie("postloop_token");

    req.flash(
      "success_msg",
      "Password changed successfully. Please login again.",
    );
    res.redirect("/login");
  } catch (err) {
    next(err);
  }
};
