const { validate } = require("express-validation");
const authRouter = require("express").Router();
const rateLimiter = require("../../middlewares/rateLimiter.middleware");

const {
  signUp,
  logIn,
  logOut,
  changePassword,
} = require("../../controllers/api/auth.controller");
const {
  signUpSchema,
  logInSchema,
  changePasswordSchema,
} = require("../../validations/api/auth.validation");
const { authenticate } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/multer");

// Public endpoints with strict limits
authRouter.post(
  "/signup",
  // // rateLimiter(3600, 3, "signup"),
  upload.single("profilePicture"),
  validate(signUpSchema),
  signUp,
);

authRouter.post(
  "/login",
  // // rateLimiter(300, 5, "login"),
  validate(logInSchema),
  logIn,
);

authRouter.post(
  "/change-password",
  authenticate,
  // rateLimiter(300, 5, "change-pw"),
  validate(changePasswordSchema),
  changePassword,
);

authRouter.post(
  "/logout",
  authenticate, // rateLimiter(60, 20, "logout"),
  logOut,
);

module.exports = authRouter;
