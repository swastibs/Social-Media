const express = require("express");
const router = express.Router();
const { validate } = require("express-validation");

const { isAuthenticated } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/authorize.middleware");
const { ROLES } = require("../../constant/role");
const rateLimiter = require("../../middlewares/rateLimiter.middleware");
const webCacheMiddleware = require("../../middlewares/webCache.middleware");
const { invalidateCache } = require("../../middlewares/invalidate.middleware");

const adminController = require("../../controllers/web/admin.controller");

// All admin routes require authentication + admin role
router.use(isAuthenticated, authorize(ROLES.ADMIN));

// Admin writes can change admin lists/detail pages and public feed/profile/post/search views.
// webCacheMiddleware stores keys as web:cache:/path|user:id.
const invalidateAdminCache = invalidateCache([
  "admin:web:*",
  "web:cache:/admin*",
  "web:cache:/feed*",
  "web:cache:/profile*",
  "web:cache:/post*",
  "web:cache:/search*",
  "cache:/api/users*",
  "cache:/api/posts*",
  "cache:/api/comments*",
  "cache:/api/activities*",
]);

// ========== PAGES (cached) ==========
router.get("/dashboard", webCacheMiddleware(60 * 5), adminController.dashboard);
router.get("/users", webCacheMiddleware(60 * 5), adminController.users);
router.get("/posts", webCacheMiddleware(60 * 5), adminController.posts);
router.get("/comments", webCacheMiddleware(60 * 5), adminController.comments);
router.get(
  "/activities",
  webCacheMiddleware(60 * 5),
  adminController.activities,
);
router.get("/search", webCacheMiddleware(60 * 5), adminController.search);

// Single entity views (admin actions)
router.get(
  "/user/:userId",
  webCacheMiddleware(60 * 5),
  adminController.userProfile,
);
router.get(
  "/post/:postId",
  webCacheMiddleware(60 * 5),
  adminController.postDetail,
);
// (optional) router.get("/comment/:commentId", ...)

// ========== ACTIONS (invalidate cache) ==========
// User actions
router.post(
  "/user/:userId/activate",
  rateLimiter(60, 10, "admin-activate"),
  invalidateAdminCache,
  adminController.activateUser,
);
router.post(
  "/user/:userId/deactivate",
  rateLimiter(60, 10, "admin-deactivate"),
  invalidateAdminCache,
  adminController.deactivateUser,
);
router.post(
  "/user/:userId/promote",
  rateLimiter(60, 10, "admin-promote"),
  invalidateAdminCache,
  adminController.promoteToAdmin,
);
router.post(
  "/user/:userId/delete",
  rateLimiter(60, 10, "admin-delete-user"),
  invalidateAdminCache,
  adminController.deleteUser,
);

// Post actions
router.post(
  "/post/:postId/delete",
  rateLimiter(60, 20, "admin-delete-post"),
  invalidateAdminCache,
  adminController.deletePost,
);

// Comment actions
router.post(
  "/comment/:commentId/delete",
  rateLimiter(60, 20, "admin-delete-comment"),
  invalidateAdminCache,
  adminController.deleteComment,
);

module.exports = router;
