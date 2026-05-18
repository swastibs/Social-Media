const commentRouter = require("express").Router();
const { validate } = require("express-validation");

const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/authorize.middleware");
const { ROLES } = require("../../constant/role");
const rateLimiter = require("../../middlewares/rateLimiter.middleware");

const {
  createComment,
  getAllComments,
  getComment,
  updateComment,
  deleteComment,
} = require("../../controllers/api/comment.controller");

const {
  createCommentSchema,
  updateCommentSchema,
  commentIdParamSchema,
  getAllCommentsSchema,
} = require("../../validations/api/comment.validation");

const { cacheMiddleware } = require("../../middlewares/cache.middleware");
const { invalidateCache } = require("../../middlewares/invalidate.middleware");

// Authentication middleware for all routes
commentRouter.use(authenticate);

// Create Comment
commentRouter.post(
  "/",
  authorize(ROLES.USER),
  rateLimiter(60, 30, "create-comment"),
  validate(createCommentSchema),
  invalidateCache(["cache:/api/comments*", "cache:/api/activities*"]),
  createComment,
);

// Get All Comments
commentRouter.get(
  "/",
  authorize(ROLES.ADMIN),
  rateLimiter(60, 100, "get-comments"),
  validate(getAllCommentsSchema),
  cacheMiddleware(),
  getAllComments,
);

// Get Single Comment
commentRouter.get(
  "/:commentId",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-comment"),
  validate(commentIdParamSchema),
  cacheMiddleware(),
  getComment,
);

// Update Comment
commentRouter.put(
  "/:commentId",
  authorize(ROLES.USER),
  rateLimiter(60, 30, "update-comment"),
  validate(updateCommentSchema),
  invalidateCache(["cache:/api/comments*", "cache:/api/activities*"]),
  updateComment,
);

// Delete Comment
commentRouter.delete(
  "/:commentId",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 30, "delete-comment"),
  validate(commentIdParamSchema),
  invalidateCache(["cache:/api/comments*", "cache:/api/activities*"]),
  deleteComment,
);

module.exports = commentRouter;
