const userRouter = require("express").Router();
const { validate } = require("express-validation");

const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/authorize.middleware");
const { ROLES } = require("../../constant/role");

const upload = require("../../middlewares/multer");
const rateLimiter = require("../../middlewares/rateLimiter.middleware");

const {
  getAllUsers,
  getUser,
  deleteUser,
  updateUserAction,
  getAllPostsOfUser,
  getPostOfUser,
  getAllCommentsOfUser,
  getCommentOfUser,
  followUnfollowUser,
  getFollowers,
  getFollowing,
  updateProfile,
} = require("../../controllers/api/user.controller");

const {
  userIdParamSchema,
  getAllUsersSchema,
  updateUserActionSchema,
  getAllPostsOfUserSchema,
  getPostOfUserSchema,
  getAllCommentsOfUserSchema,
  getCommentOfUserSchema,
  followUserSchema,
  getFollowersSchema,
  getFollowingSchema,
  updateProfileSchema,
} = require("../../validations/api/user.validation");

const { cacheMiddleware } = require("../../middlewares/cache.middleware");
const { invalidateCache } = require("../../middlewares/invalidate.middleware");

// Authentication middleware for all routes
userRouter.use(authenticate);

// Get All Users
userRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-users"),
  validate(getAllUsersSchema),
  cacheMiddleware(),
  getAllUsers,
);

// Get Single User
userRouter.get(
  "/:userId",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-user"),
  validate(userIdParamSchema),
  cacheMiddleware(),
  getUser,
);

// Delete User
userRouter.delete(
  "/:userId",
  authorize(ROLES.ADMIN),
  rateLimiter(60, 10, "admin-delete"),
  validate(userIdParamSchema),
  invalidateCache(["cache:/api/users*", "cache:/api/activities*"]),
  deleteUser,
);

// Get All Posts Of User
userRouter.get(
  "/:userId/posts",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-user-posts"),
  validate(getAllPostsOfUserSchema),
  cacheMiddleware(),
  getAllPostsOfUser,
);

// Get Single Post Of User
userRouter.get(
  "/:userId/posts/:postId",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-user-post"),
  validate(getPostOfUserSchema),
  cacheMiddleware(),
  getPostOfUser,
);

// Get All Comments Of User
userRouter.get(
  "/:userId/comments",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-user-comments"),
  validate(getAllCommentsOfUserSchema),
  cacheMiddleware(),
  getAllCommentsOfUser,
);

// Get Single Comment Of User
userRouter.get(
  "/:userId/comments/:commentId",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-user-comment"),
  validate(getCommentOfUserSchema),
  cacheMiddleware(),
  getCommentOfUser,
);

// Follow / Unfollow User
userRouter.put(
  "/:userId/follow",
  authorize(ROLES.USER),
  rateLimiter(60, 30, "follow-user"),
  validate(followUserSchema),
  invalidateCache(["cache:/api/users*", "cache:/api/activities*"]),
  followUnfollowUser,
);

// Admin User Action
userRouter.put(
  "/:userId/:action",
  authorize(ROLES.ADMIN),
  rateLimiter(60, 20, "admin-action"),
  validate(updateUserActionSchema),
  invalidateCache(["cache:/api/users*", "cache:/api/activities*"]),
  updateUserAction,
);

// Update User Profile
userRouter.put(
  "/profile",
  authorize(ROLES.USER),
  rateLimiter(60, 10, "update-profile"),
  validate(updateProfileSchema),
  upload.single("profilePicture"),
  invalidateCache(["cache:/api/users*", "cache:/api/activities*"]),
  updateProfile,
);

// Get Followers
userRouter.get(
  "/:userId/followers",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-followers"),
  validate(getFollowersSchema),
  cacheMiddleware(),
  getFollowers,
);

// Get Following
userRouter.get(
  "/:userId/following",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-following"),
  validate(getFollowingSchema),
  cacheMiddleware(),
  getFollowing,
);

module.exports = userRouter;
