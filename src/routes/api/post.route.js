const postRouter = require("express").Router();
const { validate } = require("express-validation");

const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/authorize.middleware");
const { ROLES } = require("../../constant/role");
const upload = require("../../middlewares/multer");

const {
  createPost,
  getAllPosts,
  getPost,
  updatePost,
  deletePost,
  likePost,
  getAllCommentsOfPost,
  getCommentOfPost,
} = require("../../controllers/api/post.controller");

const {
  createPostSchema,
  updatePostSchema,
  postIdParamSchema,
  getAllPostsSchema,
  likePostSchema,
  getAllCommentsOfPostSchema,
  getCommentOfPostSchema,
} = require("../../validations/api/post.validation");

const { cacheMiddleware } = require("../../middlewares/cache.middleware");
const { invalidateCache } = require("../../middlewares/invalidate.middleware");
const rateLimiter = require("../../middlewares/rateLimiter.middleware");

// Authentication middleware for all routes
postRouter.use(authenticate);

// Create Post
postRouter.post(
  "/",
  authorize(ROLES.USER),
  rateLimiter(60, 20, "create-post"), // 20 requests per minute
  upload.single("image"),
  validate(createPostSchema),
  invalidateCache(["cache:/api/posts*", "cache:/api/activities*"]),
  createPost,
);

// Get All Posts
postRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-posts"), // 100 requests per minute
  validate(getAllPostsSchema),
  cacheMiddleware(),
  getAllPosts,
);

// Get Single Post
postRouter.get(
  "/:postId",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-post"), // 100 requests per minute
  validate(postIdParamSchema),
  cacheMiddleware(),
  getPost,
);

// Update Post
postRouter.put(
  "/:postId",
  authorize(ROLES.USER),
  rateLimiter(60, 20, "update-post"), // 20 requests per minute
  validate(updatePostSchema),
  invalidateCache(["cache:/api/posts*", "cache:/api/activities*"]),
  updatePost,
);

// Delete Post
postRouter.delete(
  "/:postId",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 20, "delete-post"), // 20 requests per minute
  validate(postIdParamSchema),
  invalidateCache(["cache:/api/posts*", "cache:/api/activities*"]),
  deletePost,
);

// Like / Unlike Post
postRouter.put(
  "/:postId/like",
  authorize(ROLES.USER),
  rateLimiter(60, 30, "like-post"), // 30 requests per minute
  validate(likePostSchema),
  invalidateCache(["cache:/api/posts*", "cache:/api/activities*"]),
  likePost,
);

// Get All Comments Of A Post
postRouter.get(
  "/:postId/comments",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-post-comments"), // 100 requests per minute
  validate(getAllCommentsOfPostSchema),
  cacheMiddleware(),
  getAllCommentsOfPost,
);

// Get Single Comment Of A Post
postRouter.get(
  "/:postId/comments/:commentId",
  authorize(ROLES.ADMIN, ROLES.USER),
  rateLimiter(60, 100, "get-post-comment"), // 100 requests per minute
  validate(getCommentOfPostSchema),
  cacheMiddleware(),
  getCommentOfPost,
);

module.exports = postRouter;
