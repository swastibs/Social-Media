const express = require("express");
const router = express.Router();
const { validate } = require("express-validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/multer");
const authWeb = require("../../controllers/web/auth.web");
const { webSignUpSchema, webLoginSchema } = require("../../validations/web/auth.validation");

// Public routes with validation
router.get("/", authWeb.landing);

router.get("/login", authWeb.loginForm);
router.post("/login", validate(webLoginSchema), authWeb.login);

router.get("/signup", authWeb.signupForm);
router.post("/signup", upload.single("profilePicture"), validate(webSignUpSchema), authWeb.signup);

router.get("/logout", authWeb.logout);

// Protected routes
router.get("/feed", authenticate, (req, res) => {
  res.send("Feed page – coming soon");
});

module.exports = router;