const router = require("express").Router();

const authRouter = require("./auth.route");
const userRouter = require("./user.route");
const postRouter = require("./post.route");
const commentRouter = require("./comment.route");
const activityRouter = require("./activity.route");

router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/posts", postRouter);
router.use("/comments", commentRouter);
router.use("/activities", activityRouter);

module.exports = router;
