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

const {
  createOrder,
  verifyPayment,
  razorpayWebhook,
} = require("../../controllers/web/payment.web");

const { storeToken } = require("../../utils/authCache");

const invalidateWebCache = invalidateCache(["web:*"]);

const blockAdminFromUserRoutes = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    req.flash("error_msg", "Admins cannot access user pages.");
    return res.redirect("/admin/dashboard");
  }
  next();
};

const adminRouter = require("./admin.route");

router.use("/admin", adminRouter);

router.get("/", redirectIfLoggedIn, landing);
router.get("/login", redirectIfLoggedIn, loginForm);
router.get("/signup", redirectIfLoggedIn, signupForm);

router.post(
  "/login",

  validate(webLoginSchema),
  invalidateWebCache,
  login,
);
router.post(
  "/signup",

  upload.single("profilePicture"),
  validate(webSignUpSchema),
  invalidateWebCache,
  signup,
);
router.post(
  "/logout",
  isAuthenticated,

  invalidateWebCache,
  logout,
);

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

  validate(changePasswordSchema),
  invalidateWebCache,
  changePassword,
);

router.get("/forgot-password", forgotController.showForgotForm);
router.post(
  "/forgot-password",

  validate(forgotPasswordSchema),
  forgotController.requestReset,
);
router.get("/reset-password", forgotController.showResetForm);
router.post(
  "/reset-password",

  validate(resetPasswordSchema),
  forgotController.resetPassword,
);

router.get(
  "/feed",
  isAuthenticated,
  blockAdminFromUserRoutes,

  renderFeed,
);

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

  validate(userIdParamSchema),
  invalidateWebCache,
  acceptFollowRequest,
);
router.post(
  "/follow-requests/:userId/reject",
  isAuthenticated,
  blockAdminFromUserRoutes,

  validate(userIdParamSchema),
  invalidateWebCache,
  rejectFollowRequest,
);

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

  validate(userIdParamSchema),
  invalidateWebCache,
  toggleFollow,
);
router.post(
  "/profile/:userId/followers/remove/:followerId",
  isAuthenticated,
  blockAdminFromUserRoutes,

  removeFollower,
);

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

  upload.single("image"),
  validate(updatePostSchema),
  invalidateWebCache,
  updatePost,
);
router.post(
  "/post/delete/:postId",
  isAuthenticated,
  blockAdminFromUserRoutes,

  validate(postIdParamSchema),
  invalidateWebCache,
  deletePost,
);
router.post(
  "/post/:postId/like",
  isAuthenticated,
  blockAdminFromUserRoutes,

  validate(postIdParamSchema),
  invalidateWebCache,
  toggleLike,
);

router.post(
  "/comment/create",
  isAuthenticated,
  blockAdminFromUserRoutes,

  validate(createCommentSchema),
  invalidateWebCache,
  createComment,
);
router.put(
  "/comment/:commentId",
  isAuthenticated,
  blockAdminFromUserRoutes,

  validate(updateCommentSchema),
  invalidateWebCache,
  updateComment,
);
router.delete(
  "/comment/:commentId",
  isAuthenticated,
  blockAdminFromUserRoutes,

  validate(commentIdParamSchema),
  invalidateWebCache,
  deleteComment,
);

router.get(
  "/search",
  isAuthenticated,
  blockAdminFromUserRoutes,
  webCacheMiddleware(60 * 30),
  searchPage,
);

router.post(
  "/payment/create-order",
  isAuthenticated,

  createOrder,
);
router.post(
  "/payment/verify-payment",
  isAuthenticated,

  verifyPayment,
);

router.post(
  "/payment/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

router.post(
  "/profile/privacy",
  isAuthenticated,
  blockAdminFromUserRoutes,

  invalidateWebCache,
  togglePrivacy,
);

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
