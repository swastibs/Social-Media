const express = require("express");
const router = express.Router();
const { validate } = require("express-validation");

const { redirectIfLoggedIn, isAuthenticated } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/multer");
const { landing, loginForm, login, signupForm, signup, logout } = require("../../controllers/web/auth.web");
const { webSignUpSchema, webLoginSchema } = require("../../validations/web/auth.validation");
const { renderFeed } = require("../../controllers/web/feed.web");
const { toggleFollow } = require("../../controllers/web/user.web");
const { toggleLike } = require("../../controllers/web/post.web");
const { renderProfile, renderFollowers, renderFollowing } = require("../../controllers/web/profile.web");

// Public
router.get("/", redirectIfLoggedIn, landing);

router.get("/login", redirectIfLoggedIn, loginForm);
router.post("/login", validate(webLoginSchema), login);

router.get("/signup", redirectIfLoggedIn, signupForm);
router.post("/signup", upload.single("profilePicture"), validate(webSignUpSchema), signup);

router.get("/logout", logout);

// Protected (require login)
router.get("/feed", isAuthenticated, renderFeed);
router.get("/profile/:userId", isAuthenticated, renderProfile);
router.get("/profile/:userId/followers", isAuthenticated, renderFollowers);
router.get("/profile/:userId/following", isAuthenticated, renderFollowing);
router.post("/follow/:userId", isAuthenticated, toggleFollow);
router.post("/post/:postId/like", isAuthenticated, toggleLike);

module.exports = router;