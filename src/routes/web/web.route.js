const express = require("express");
const router = express.Router();
const { validate } = require("express-validation");
const { redirectIfLoggedIn, isAuthenticated } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/multer");
const { landing, loginForm, login, signupForm, signup, logout } = require("../../controllers/web/auth.web");
const { webSignUpSchema, webLoginSchema } = require("../../validations/web/auth.validation");

// Public routes – redirect to feed if already logged in
router.get("/", redirectIfLoggedIn, landing);

router.get("/login", redirectIfLoggedIn, loginForm);
router.post("/login", validate(webLoginSchema), login);

router.get("/signup", redirectIfLoggedIn, signupForm);
router.post("/signup", upload.single("profilePicture"), validate(webSignUpSchema), signup);

router.get("/logout", logout);

// Protected routes – use ensureAuthenticated instead of authenticate
router.get("/feed", isAuthenticated, (req, res) => {
  res.send("Feed page - coming soon");
});

module.exports = router;