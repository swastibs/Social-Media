const activityRouter = require("express").Router();
const { validate } = require("express-validation");

const rateLimiter = require("../../middlewares/rateLimiter.middleware");
const { cacheMiddleware } = require("../../middlewares/cache.middleware");
const { getActivities } = require("../../controllers/api/activity.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/authorize.middleware");
const { ROLES } = require("../../constant/role");
const {
  getActivitiesSchema,
} = require("../../validations/api/activity.validation");

// Get Activity Logs
activityRouter.get(
  "/",
  authenticate,
  authorize(ROLES.ADMIN),
  rateLimiter(60, 50, "activity-logs"),
  validate(getActivitiesSchema),
  cacheMiddleware(),
  getActivities,
);

module.exports = activityRouter;
