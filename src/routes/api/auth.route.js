const { validate } = require("express-validation");
const authRouter = require("express").Router();

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

authRouter.post(
  "/signup",

  upload.single("profilePicture"),
  validate(signUpSchema),
  signUp,
);

authRouter.post(
  "/login",

  validate(logInSchema),
  logIn,
);

authRouter.post(
  "/change-password",
  authenticate,

  validate(changePasswordSchema),
  changePassword,
);

authRouter.post("/logout", authenticate, logOut);

module.exports = authRouter;
