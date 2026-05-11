const { validate } = require("express-validation");
const authRouter = require("express").Router();

const { signUp, logIn, logOut } = require("../controllers/auth.controller");
const { signUpSchema, logInSchema } = require("../validations/auth.validation");
const { invalidateCache } = require("../middlewares/invalidate.middleware");
const { authenticate } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/multer");

authRouter.post(
  "/signup",
  upload.single("profilePicture"),
  validate(signUpSchema),
  invalidateCache(["cache:/api/users*", "cache:/api/activities*"]),
  signUp,
);
authRouter.post("/login", validate(logInSchema), logIn);
authRouter.post("/logout", authenticate, logOut);

module.exports = authRouter;
