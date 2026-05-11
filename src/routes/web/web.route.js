const express = require("express");
const router = express.Router();
const { validate } = require("express-validation");

const { redirectIfLoggedIn, isAuthenticated } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/multer");
const { landing, loginForm, login, signupForm, signup, logout } = require("../../controllers/web/auth.web");
const { webSignUpSchema, webLoginSchema } = require("../../validations/web/auth.validation");
const feedWeb = require("../../controllers/web/feed.web");
const userWeb = require("../../controllers/web/user.web");
const postWeb = require("../../controllers/web/post.web");

// Public
router.get("/", redirectIfLoggedIn, landing);

router.get("/login", redirectIfLoggedIn, loginForm);
router.post("/login", validate(webLoginSchema), login);

router.get("/signup", redirectIfLoggedIn, signupForm);
router.post("/signup", upload.single("profilePicture"), validate(webSignUpSchema), signup);

router.get("/logout", logout);

// Protected (require login)
router.get("/feed", isAuthenticated, feedWeb.renderFeed);
router.post("/follow/:userId", isAuthenticated, userWeb.toggleFollow);
router.post("/post/:postId/like", isAuthenticated, postWeb.toggleLike);

module.exports = router;