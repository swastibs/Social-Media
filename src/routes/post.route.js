const postRouter = require("express").Router();
const { validate } = require("express-validation");

const { authenticate } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/authorize.middleware");
const { ROLES } = require("../constant/role");
const upload = require("../middlewares/multer");

const {
  createPost,
  getAllPosts,
  getPost,
  updatePost,
  deletePost,
  likePost,
  getAllCommentsOfPost,
  getCommentOfPost,
} = require("../controllers/post.controller");

const {
  createPostSchema,
  updatePostSchema,
  postIdParamSchema,
  getAllPostsSchema,
  likePostSchema,
  getAllCommentsOfPostSchema,
  getCommentOfPostSchema,
} = require("../validations/post.validation");
const { cacheMiddleware } = require("../middlewares/cache.middleware");
const { invalidateCache } = require("../middlewares/invalidate.middleware");

postRouter.use(authenticate);

postRouter.post(
  "/",
  authorize(ROLES.USER),
  upload.single("image"),
  validate(createPostSchema),
  invalidateCache(["cache:/api/posts*", "cache:/api/activities*"]),
  createPost,
);

postRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.USER),
  validate(getAllPostsSchema),
  cacheMiddleware(),
  getAllPosts,
);

postRouter.get(
  "/:postId",
  authorize(ROLES.ADMIN, ROLES.USER),
  validate(postIdParamSchema),
  cacheMiddleware(),
  getPost,
);

postRouter.put(
  "/:postId",
  authorize(ROLES.USER),
  validate(updatePostSchema),
  invalidateCache(["cache:/api/posts*", "cache:/api/activities*"]),
  updatePost,
);

postRouter.delete(
  "/:postId",
  authorize(ROLES.ADMIN, ROLES.USER),
  validate(postIdParamSchema),
  invalidateCache(["cache:/api/posts*", "cache:/api/activities*"]),
  deletePost,
);

postRouter.put(
  "/:postId/like",
  authorize(ROLES.USER),
  validate(likePostSchema),
  invalidateCache(["cache:/api/posts*", "cache:/api/activities*"]),
  likePost,
);

postRouter.get(
  "/:postId/comments",
  authorize(ROLES.ADMIN, ROLES.USER),
  validate(getAllCommentsOfPostSchema),
  cacheMiddleware(),
  getAllCommentsOfPost,
);

postRouter.get(
  "/:postId/comments/:commentId",
  authorize(ROLES.ADMIN, ROLES.USER),
  validate(getCommentOfPostSchema),
  cacheMiddleware(),
  getCommentOfPost,
);

module.exports = postRouter;
