const router = require("express").Router();
const authRouter = require("./auth.route");
const userRouter = require("./user.route");
const postRouter = require("./post.route");
const commentRouter = require("./comment.route");
const activityRouter = require("./activity.route");
const paymentRouter = require("./payment.route");

// router.use(rateLimiter(60, 200, "api-global"));

// API Routes
const feedRouter = require("./feed.route"); // 👈 ADD THIS

router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/posts", postRouter);
router.use("/comments", commentRouter);
router.use("/activities", activityRouter);
router.use("/payments", paymentRouter);
router.use("/feed", feedRouter); // 👈 ADD THIS

module.exports = router;
