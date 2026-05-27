/**
 * Web Routes (User‑facing)
 *
 * All routes except /admin. Handles authentication, profile, feed,
 * posts, comments, search, follow requests, password reset, GitHub OAuth.
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { validate } = require("express-validation");
const passport = require("passport");

const rateLimiter = require("../../middlewares/rateLimiter.middleware");
const {
  redirectIfLoggedIn,
  isAuthenticated,
} = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/multer");
const webCacheMiddleware = require("../../middlewares/webCache.middleware");
const { invalidateCache } = require("../../middlewares/invalidate.middleware");

// Controllers
const {
  landing,
  loginForm,
  login,
  signupForm,
  signup,
  logout,
  changePasswordForm,
  changePassword,
} = require("../../controllers/web/auth.web");

const {
  webSignUpSchema,
  webLoginSchema,
  changePasswordSchema,
} = require("../../validations/web/auth.validation");

const {
  updateProfileSchema,
  userIdParamSchema,
} = require("../../validations/web/profile.validation");

const { renderFeed } = require("../../controllers/web/feed.web");

const {
  toggleFollow,
  showFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  removeFollower,
} = require("../../controllers/web/user.web");

const {
  renderProfile,
  renderFollowers,
  renderFollowing,
  renderEditProfile,
  updateProfile,
  togglePrivacy,
} = require("../../controllers/web/profile.web");

const {
  createPostForm,
  createPost,
  postDetail,
  editPostForm,
  updatePost,
  deletePost,
  toggleLike,
} = require("../../controllers/web/post.web");

const {
  createPostSchema,
  updatePostSchema,
  postIdParamSchema,
} = require("../../validations/web/post.validation");

const {
  createComment,
  updateComment,
  deleteComment,
} = require("../../controllers/web/comment.web");

const {
  createCommentSchema,
  updateCommentSchema,
  commentIdParamSchema,
} = require("../../validations/web/comment.validation");

const {
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../../validations/web/forgotPassword.validation");

const { searchPage } = require("../../controllers/web/search.web");

const forgotController = require("../../controllers/web/forgotPassword.controller");

// Payment controllers (web)
const {
  createOrder,
  verifyPayment,
  razorpayWebhook,
} = require("../../controllers/web/payment.web");

const { storeToken } = require("../../utils/authCache");

// Invalidate cache helper for web mutations
const invalidateWebCache = invalidateCache(["web:*"]);

// Block admin from accessing user routes
const blockAdminFromUserRoutes = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    req.flash("error_msg", "Admins cannot access user pages.");
    return res.redirect("/admin/dashboard");
  }
  next();
};

const adminRouter = require("./admin.route");
// ...
router.use("/admin", adminRouter);

// ========== Public Routes (no auth) ==========
router.get("/", redirectIfLoggedIn, landing);
router.get("/login", redirectIfLoggedIn, loginForm);
router.get("/signup", redirectIfLoggedIn, signupForm);

// ========== Auth Routes ==========
router.post(
  "/login",
  rateLimiter(300, 5, "web-login"),
  validate(webLoginSchema),
  invalidateWebCache,
  login,
);
router.post(
  "/signup",
  rateLimiter(3600, 3, "web-signup"),
  upload.single("profilePicture"),
  validate(webSignUpSchema),
  invalidateWebCache,
  signup,
);
router.post(
  "/logout",
  isAuthenticated,
  rateLimiter(60, 20, "web-logout"),
  invalidateWebCache,
  logout,
);

// ========== Password Change ==========
router.get(
  "/change-password",
  isAuthenticated,
  blockAdminFromUserRoutes,
  changePasswordForm,
);
router.post(
  "/change-password",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(300, 5, "web-change-password"),
  validate(changePasswordSchema),
  invalidateWebCache,
  changePassword,
);

// ========== Forgot / Reset Password ==========
router.get("/forgot-password", forgotController.showForgotForm);
router.post(
  "/forgot-password",
  rateLimiter(60, 3, "forgot-pw"),
  validate(forgotPasswordSchema),
  forgotController.requestReset,
);
router.get("/reset-password", forgotController.showResetForm);
router.post(
  "/reset-password",
  rateLimiter(60, 5, "reset-pw"),
  validate(resetPasswordSchema),
  forgotController.resetPassword,
);

// ========== Feed ==========
router.get(
  "/feed",
  isAuthenticated,
  blockAdminFromUserRoutes,

  renderFeed,
);

// ========== Follow Requests ==========
router.get(
  "/follow-requests",
  isAuthenticated,
  blockAdminFromUserRoutes,
  webCacheMiddleware(60 * 5),
  showFollowRequests,
);
router.post(
  "/follow-requests/:userId/accept",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 20, "accept-follow"),
  validate(userIdParamSchema),
  invalidateWebCache,
  acceptFollowRequest,
);
router.post(
  "/follow-requests/:userId/reject",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 20, "reject-follow"),
  validate(userIdParamSchema),
  invalidateWebCache,
  rejectFollowRequest,
);

// ========== Profile ==========
router.get(
  "/profile/edit",
  isAuthenticated,
  blockAdminFromUserRoutes,
  renderEditProfile,
);
router.post(
  "/profile/edit",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 10, "web-edit-profile"),
  upload.single("profilePicture"),
  validate(updateProfileSchema),
  invalidateWebCache,
  updateProfile,
);
router.get(
  "/profile/:userId",
  isAuthenticated,
  blockAdminFromUserRoutes,
  validate(userIdParamSchema),
  webCacheMiddleware(60 * 60 * 6),
  renderProfile,
);
router.get(
  "/profile/:userId/followers",
  isAuthenticated,
  blockAdminFromUserRoutes,
  validate(userIdParamSchema),
  webCacheMiddleware(60 * 60 * 2),
  renderFollowers,
);
router.get(
  "/profile/:userId/following",
  isAuthenticated,
  blockAdminFromUserRoutes,
  validate(userIdParamSchema),
  webCacheMiddleware(60 * 60 * 2),
  renderFollowing,
);
router.post(
  "/follow/:userId",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 30, "web-follow"),
  validate(userIdParamSchema),
  invalidateWebCache,
  toggleFollow,
);
router.post(
  "/profile/:userId/followers/remove/:followerId",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 20, "remove-follower"),
  removeFollower,
);

// ========== Posts ==========
router.get(
  "/post/create",
  isAuthenticated,
  blockAdminFromUserRoutes,
  createPostForm,
);
router.post(
  "/post/create",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 20, "web-create-post"),
  upload.single("image"),
  validate(createPostSchema),
  invalidateWebCache,
  createPost,
);
router.get(
  "/post/:postId",
  isAuthenticated,
  blockAdminFromUserRoutes,
  validate(postIdParamSchema),
  // webCacheMiddleware(60 * 60 * 6),
  postDetail,
);
router.get(
  "/post/edit/:postId",
  isAuthenticated,
  blockAdminFromUserRoutes,
  validate(postIdParamSchema),
  editPostForm,
);
router.post(
  "/post/edit/:postId",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 20, "web-edit-post"),
  upload.single("image"),
  validate(updatePostSchema),
  invalidateWebCache,
  updatePost,
);
router.post(
  "/post/delete/:postId",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 20, "web-delete-post"),
  validate(postIdParamSchema),
  invalidateWebCache,
  deletePost,
);
router.post(
  "/post/:postId/like",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 30, "web-like-post"),
  validate(postIdParamSchema),
  invalidateWebCache,
  toggleLike,
);

// ========== Comments ==========
router.post(
  "/comment/create",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 30, "web-create-comment"),
  validate(createCommentSchema),
  invalidateWebCache,
  createComment,
);
router.put(
  "/comment/:commentId",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 30, "web-update-comment"),
  validate(updateCommentSchema),
  invalidateWebCache,
  updateComment,
);
router.delete(
  "/comment/:commentId",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 30, "web-delete-comment"),
  validate(commentIdParamSchema),
  invalidateWebCache,
  deleteComment,
);

// ========== Search ==========
router.get(
  "/search",
  isAuthenticated,
  blockAdminFromUserRoutes,
  webCacheMiddleware(60 * 30),
  searchPage,
);

// ========== Payments (AJAX & Webhook) ==========
router.post(
  "/payment/create-order",
  isAuthenticated,
  rateLimiter(60, 10, "create-order"),
  createOrder,
);
router.post(
  "/payment/verify-payment",
  isAuthenticated,
  rateLimiter(60, 10, "verify-payment"),
  verifyPayment,
);
// Webhook (no auth, raw body) – must come before express.json()
router.post(
  "/payment/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

// ========== Privacy Toggle (AJAX) ==========
router.post(
  "/profile/privacy",
  isAuthenticated,
  blockAdminFromUserRoutes,
  rateLimiter(60, 20, "toggle-privacy"),
  invalidateWebCache,
  togglePrivacy,
);

// ========== GitHub OAuth ==========
router.get("/auth/github", passport.authenticate("github"));
router.get(
  "/auth/github/callback",
  passport.authenticate("github", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  async (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );
    await storeToken(token, req.user.id);
    res.cookie("postloop_token", token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
    if (req.user.role === "admin") return res.redirect("/admin/dashboard");
    res.redirect("/feed");
  },
);

module.exports = router;
