const { User } = require("../../models");
const { compare, hash } = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  storeToken,
  deleteToken,
  deleteAllUserTokens,
} = require("../../utils/authCache");
const { uploadToCloudinary } = require("../../utils/cloudinaryUpload");

exports.landing = (req, res) => {
  if (req.user) return res.redirect("/feed");
  res.render("landing", {
    mode: "login",
    oldInput: {},
  });
};

exports.loginForm = (req, res) => {
  if (req.user) return res.redirect("/feed");

  res.render("landing", {
    mode: "login",
    oldInput: req.flash("oldInput")[0] || {},
  });
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email, isDeleted: false } });
    if (!user || !(await compare(password, user.password)) || !user.isActive) {
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
    res.cookie("token", token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.redirect("/feed");
  } catch (err) {
    next(err);
  }
};

exports.signupForm = (req, res) => {
  if (req.user) return res.redirect("/feed");

  res.render("landing", {
    mode: "signup",
    oldInput: req.flash("oldInput")[0] || {},
  });
};

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
    let profilePictureUrl = null;
    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file, "postloop/profiles");
      profilePictureUrl = uploaded.secure_url;
    }
    await User.create({
      name,
      email,
      password: hashed,
      bio: bio || null,
      profilePictureUrl,
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
    });
    req.flash("success_msg", "Account created! Please log in.");
    res.redirect("/login");
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res) => {
  const token = req.cookies.token;
  const userId = req.user?.id;

  if (token) {
    await deleteToken(token);
    await removeTokenFromUser(userId, token);
  }

  res.clearCookie("token");
  req.flash("success_msg", "You have been logged out.");
  res.redirect("/");
};

exports.changePasswordForm = (req, res) => {
  res.render("auth/change-password", {
    title: "Change Password",
    user: req.user,
    error: null,
    oldInput: {},
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

    // Verify old password
    const isMatch = await compare(oldPassword, user.password);
    if (!isMatch) {
      req.flash("error_msg", "Old password is incorrect");
      req.flash("oldInput", { oldPassword: req.body.oldPassword });
      return res.redirect("/change-password");
    }

    // Hash and update new password
    const hashedPassword = await hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // 🔥 INVALIDATE ALL TOKENS FOR THIS USER
    await deleteAllUserTokens(userId);

    // Clear current cookie
    res.clearCookie("token");

    req.flash(
      "success_msg",
      "Password changed successfully. Please login again.",
    );
    res.redirect("/login");
  } catch (err) {
    next(err);
  }
};
