const feedRouter = require("express").Router();
const { validate } = require("express-validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/authorize.middleware");
const { ROLES } = require("../../constant/role");
const { getFeed } = require("../../controllers/api/feed.controller");
const { cacheMiddleware } = require("../../middlewares/cache.middleware");
const { getAllPostsSchema } = require("../../validations/api/post.validation");

feedRouter.get(
  "/",
  authenticate,
  authorize(ROLES.ADMIN, ROLES.USER),
  validate(getAllPostsSchema),
  cacheMiddleware(),
  getFeed,
);

module.exports = feedRouter;
