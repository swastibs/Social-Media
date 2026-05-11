const { validate } = require("express-validation");
const activityRouter = require("express").Router();

const { cacheMiddleware } = require("../middlewares/cache.middleware");
const { getActivities } = require("../controllers/activity.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/authorize.middleware");
const { ROLES } = require("../constant/role");

const { getActivitiesSchema } = require("../validations/activity.validation");

activityRouter.get(
  "/",
  authenticate,
  authorize(ROLES.ADMIN),
  validate(getActivitiesSchema),
  cacheMiddleware(),
  getActivities,
);

module.exports = activityRouter;
