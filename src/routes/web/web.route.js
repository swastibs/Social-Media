const express = require("express");
const router = express.Router();
const { validate } = require("express-validation");

const { redirectIfLoggedIn, isAuthenticated } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/multer");
const { landing, loginForm, login, signupForm, signup, logout, changePasswordForm, changePassword } = require("../../controllers/web/auth.web");
const { webSignUpSchema, webLoginSchema, changePasswordSchema } = require("../../validations/web/auth.validation");
const { updateProfileSchema, userIdParamSchema } = require("../../validations/web/profile.validation");
const { renderFeed } = require("../../controllers/web/feed.web");
const { toggleFollow } = require("../../controllers/web/user.web");
const { toggleLike } = require("../../controllers/web/post.web");
const { renderProfile, renderFollowers, renderFollowing, renderEditProfile, updateProfile } = require("../../controllers/web/profile.web");

// ========== PUBLIC ROUTES ==========
router.get("/", redirectIfLoggedIn, landing);
router.get("/login", redirectIfLoggedIn, loginForm);
router.get("/signup", redirectIfLoggedIn, signupForm);
router.get("/logout", logout);

// ========== PROTECTED ROUTES (require login) ==========
// Static routes (must come before dynamic ones)
router.get("/change-password", isAuthenticated, changePasswordForm);
router.get("/feed", isAuthenticated, renderFeed);
router.get("/profile/edit", isAuthenticated, renderEditProfile);

// Dynamic routes with parameter validation
router.get("/profile/:userId", isAuthenticated, validate(userIdParamSchema), renderProfile);
router.get("/profile/:userId/followers", isAuthenticated, validate(userIdParamSchema), renderFollowers);
router.get("/profile/:userId/following", isAuthenticated, validate(userIdParamSchema), renderFollowing);

// POST routes
router.post("/login", validate(webLoginSchema), login);
router.post("/signup", upload.single("profilePicture"), validate(webSignUpSchema), signup);
router.post("/follow/:userId", isAuthenticated, validate(userIdParamSchema), toggleFollow);
router.post("/post/:postId/like", isAuthenticated, toggleLike);
router.post("/profile/edit", isAuthenticated, upload.single("profilePicture"), validate(updateProfileSchema), updateProfile);
router.post("/change-password", isAuthenticated, validate(changePasswordSchema), changePassword);


module.exports = router;