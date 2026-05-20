const express = require("express");
const router = express.Router();

const { validate } = require("express-validation");
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
const { toggleFollow } = require("../../controllers/web/user.web");

const {
  renderProfile,
  renderFollowers,
  renderFollowing,
  renderEditProfile,
  updateProfile,
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

// Import admin router
const adminRouter = require("./admin.route");

const invalidateWebCache = invalidateCache(["web:*"]);

// 🔥 MIDDLEWARE TO BLOCK ADMIN FROM USER ROUTES
const blockAdminFromUserRoutes = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    req.flash("error_msg", "Admins cannot access user pages.");
    return res.redirect("/admin/dashboard");
  }
  next();
};

// Public Routes (no auth)
router.get("/", redirectIfLoggedIn, landing);
router.get("/login", redirectIfLoggedIn, loginForm);
router.get("/signup", redirectIfLoggedIn, signupForm);

// Auth Routes (no admin blocking needed – they are not logged in yet)
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

// Password change – also blocked for admin
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

// Feed – block admin
router.get(
  "/feed",
  isAuthenticated,
  blockAdminFromUserRoutes,
  webCacheMiddleware(60 * 5),
  renderFeed,
);

// Profile Routes – block admin
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

// Post Routes – block admin
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
  webCacheMiddleware(60 * 60 * 6),
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

// Comment Routes – block admin
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

// Search – block admin
router.get(
  "/search",
  isAuthenticated,
  blockAdminFromUserRoutes,
  webCacheMiddleware(60 * 30),
  searchPage,
);

// Forgot Password routes
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

// Mount admin routes (no admin blocking here – admin routes are already protected by authorize)
router.use("/admin", adminRouter);

module.exports = router;
