const { User } = require("../../models");
const { hash, compare } = require("bcrypt");
const jwt = require("jsonwebtoken");
const { storeToken, deleteToken } = require("../../utils/authCache");
const { uploadToCloudinary } = require("../../utils/cloudinaryUpload");

// Show landing page – redirect to feed if already logged in
exports.landing = (req, res) => {
  if (req.user) {
    // user is already authenticated (Passport adds req.user)
    return res.redirect("/feed");
  }
  res.render("landing", { title: "Welcome" });
};

// Show login form
exports.loginForm = (req, res) => {
  if (req.user) return res.redirect("/feed");
  res.render("auth/login", { error: null });
};

// Process login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email, isDeleted: false } });
    if (!user) throw new Error("Invalid credentials");
    if (!user.isActive) throw new Error("Account disabled");

    const match = await compare(password, user.password);
    if (!match) throw new Error("Invalid credentials");

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );
    await storeToken(token);
    res.cookie("token", token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.redirect("/feed");
  } catch (err) {
    res.render("auth/login", { error: err.message });
  }
};

// Show signup form
exports.signupForm = (req, res) => {
  if (req.user) return res.redirect("/feed");
  res.render("auth/signup", { error: null, oldInput: {} });
};

// Process signup
exports.signup = async (req, res) => {
  try {
    const { name, email, password, bio } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new Error("Email already exists");

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
    res.redirect("/login");
  } catch (err) {
    res.render("auth/signup", { error: err.message, oldInput: req.body });
  }
};

// Logout
exports.logout = async (req, res) => {
  const token = req.cookies.token;
  if (token) {
    await deleteToken(token);
  }
  res.clearCookie("token");
  res.redirect("/");
};
