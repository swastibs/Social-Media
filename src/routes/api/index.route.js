const router = require("express").Router();
const authRouter = require("./auth.route");
const userRouter = require("./user.route");
const postRouter = require("./post.route");
const commentRouter = require("./comment.route");
const activityRouter = require("./activity.route");
const paymentRouter = require("./payment.route");
const rateLimiter = require("../../middlewares/rateLimiter.middleware");
const feedRouter = require("./feed.route");
const healthController = require("../../controllers/api/health.controller");

router.get("/health", healthController.healthCheck);

router.use(rateLimiter(60, 200, "api-global"));

router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/posts", postRouter);
router.use("/comments", commentRouter);
router.use("/activities", activityRouter);
router.use("/payments", paymentRouter);
router.use("/feed", feedRouter);

module.exports = router;
