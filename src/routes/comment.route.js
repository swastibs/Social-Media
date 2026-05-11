const commentRouter = require("express").Router();
const { validate } = require("express-validation");

const { authenticate } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/authorize.middleware");
const { ROLES } = require("../constant/role");

const {
  createComment,
  getAllComments,
  getComment,
  updateComment,
  deleteComment,
} = require("../controllers/comment.controller");

const {
  createCommentSchema,
  updateCommentSchema,
  commentIdParamSchema,
  getAllCommentsSchema,
} = require("../validations/comment.validation");
const { cacheMiddleware } = require("../middlewares/cache.middleware");
const { invalidateCache } = require("../middlewares/invalidate.middleware");

commentRouter.use(authenticate);

commentRouter.post(
  "/",
  authorize(ROLES.USER),
  validate(createCommentSchema),
  invalidateCache(["cache:/api/comments*", "cache:/api/activities*"]),
  createComment,
);

commentRouter.get(
  "/",
  authorize(ROLES.ADMIN),
  validate(getAllCommentsSchema),
  cacheMiddleware(),
  getAllComments,
);

commentRouter.get(
  "/:commentId",
  authorize(ROLES.ADMIN, ROLES.USER),
  validate(commentIdParamSchema),
  cacheMiddleware(),
  getComment,
);

commentRouter.put(
  "/:commentId",
  authorize(ROLES.USER),
  validate(updateCommentSchema),
  invalidateCache(["cache:/api/comments*", "cache:/api/activities*"]),
  updateComment,
);

commentRouter.delete(
  "/:commentId",
  authorize(ROLES.ADMIN, ROLES.USER),
  validate(commentIdParamSchema),
  invalidateCache(["cache:/api/comments*", "cache:/api/activities*"]),
  deleteComment,
);

module.exports = commentRouter;
