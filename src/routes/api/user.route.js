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

  getSessions,
  revokeSessionByToken,
  revokeOtherSessions,
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

userRouter.use(authenticate);

userRouter.get(
  "/me",
  authorize(ROLES.ADMIN, ROLES.USER),
  async (req, res, next) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ["password"] },
      });
      return successResponse(res, {
        message: "Current user fetched successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },
);

userRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.USER),

  validate(getAllUsersSchema),
  cacheMiddleware(),
  getAllUsers,
);

userRouter.get(
  "/:userId",
  authorize(ROLES.ADMIN, ROLES.USER),

  validate(userIdParamSchema),
  cacheMiddleware(),
  getUser,
);

userRouter.delete(
  "/:userId",
  authorize(ROLES.ADMIN),

  validate(userIdParamSchema),
  invalidateCache(["cache:/api/users*", "cache:/api/activities*"]),
  deleteUser,
);

userRouter.get(
  "/:userId/posts",
  authorize(ROLES.ADMIN, ROLES.USER),

  validate(getAllPostsOfUserSchema),
  cacheMiddleware(),
  getAllPostsOfUser,
);

userRouter.get(
  "/:userId/posts/:postId",
  authorize(ROLES.ADMIN, ROLES.USER),

  validate(getPostOfUserSchema),
  cacheMiddleware(),
  getPostOfUser,
);

userRouter.get(
  "/:userId/comments",
  authorize(ROLES.ADMIN, ROLES.USER),

  validate(getAllCommentsOfUserSchema),
  cacheMiddleware(),
  getAllCommentsOfUser,
);

userRouter.get(
  "/:userId/comments/:commentId",
  authorize(ROLES.ADMIN, ROLES.USER),

  validate(getCommentOfUserSchema),
  cacheMiddleware(),
  getCommentOfUser,
);

userRouter.put(
  "/:userId/follow",
  authorize(ROLES.USER),

  validate(followUserSchema),
  invalidateCache(["cache:/api/users*", "cache:/api/activities*"]),
  followUnfollowUser,
);

userRouter.put(
  "/:userId/:action",
  authorize(ROLES.ADMIN),

  validate(updateUserActionSchema),
  invalidateCache(["cache:/api/users*", "cache:/api/activities*"]),
  updateUserAction,
);

userRouter.put(
  "/profile",
  authorize(ROLES.USER),

  validate(updateProfileSchema),
  upload.single("profilePicture"),
  invalidateCache(["cache:/api/users*", "cache:/api/activities*"]),
  updateProfile,
);

userRouter.get(
  "/:userId/followers",
  authorize(ROLES.ADMIN, ROLES.USER),

  validate(getFollowersSchema),
  cacheMiddleware(),
  getFollowers,
);

userRouter.get(
  "/:userId/following",
  authorize(ROLES.ADMIN, ROLES.USER),

  validate(getFollowingSchema),
  cacheMiddleware(),
  getFollowing,
);

userRouter.get(
  "/sessions",
  authorize(ROLES.USER),

  getSessions,
);

userRouter.post(
  "/revoke-session",
  authorize(ROLES.USER),

  revokeSessionByToken,
);

userRouter.post(
  "/revoke-others",
  authorize(ROLES.USER),

  revokeOtherSessions,
);

module.exports = userRouter;
