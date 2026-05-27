const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/authorize.middleware");
const { ROLES } = require("../../constant/role");
const adminController = require("../../controllers/web/admin.controller");

// Force admin layout for all routes
router.use((req, res, next) => {
  res.locals.layout = "admin/layouts/admin-main";
  next();
});

// Protect all routes
router.use(isAuthenticated, authorize(ROLES.ADMIN));

// ========== Pages ==========
router.get("/dashboard", adminController.dashboard);
router.get("/users", adminController.users);
router.get("/posts", adminController.posts);
router.get("/comments", adminController.comments);
router.get("/activities", adminController.activities);
router.get("/search", adminController.search);
router.get("/user/:userId", adminController.userProfile);
router.get("/post/:postId", adminController.postDetail);

// ========== Actions ==========
router.post("/user/:userId/activate", adminController.activateUser);
router.post("/user/:userId/deactivate", adminController.deactivateUser);
router.post("/user/:userId/promote", adminController.promoteToAdmin);
router.post("/user/:userId/delete", adminController.deleteUser);
router.post("/post/:postId/delete", adminController.deletePost);
router.post("/comment/:commentId/delete", adminController.deleteComment);

module.exports = router;
