const path = require("path");
const express = require("express");
const compression = require("compression");
const passport = require("passport");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const flash = require("connect-flash");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

const swaggerDocument = require("./src/config/swagger-output.json");
require("./src/config/passport");
const { connectDB } = require("./src/config/db");
const connectMongo = require("./src/config/mongo");

const activityLogger = require("./src/middlewares/activityLogger.middleware");
const attachUserIfLoggedIn = require("./src/middlewares/attachUser.middleware");
const { globalErrorHandler } = require("./src/middlewares/globalErrorHandeler");

const webRouter = require("./src/routes/web/web.route");
const apiRouter = require("./src/routes/api/index.route");

const app = express();

app.use(cors());

app.use(compression());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));

connectDB();
connectMongo();

app.use(
  express.static(path.join(__dirname, "src/public"), {
    maxAge: "1d",
    immutable: true,
  }),
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  }),
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(expressLayouts);
app.set("layout", "layouts/main");

app.use(passport.initialize());
app.use(passport.session());

app.use(cookieParser());

app.use(attachUserIfLoggedIn);

app.use(activityLogger);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/", webRouter);
app.use("/api", apiRouter);

app.use((req, res) => {
  res.status(404).render("error", {
    title: "Page Not Found",
    message: "The page you are looking for does not exist.",
    user: req.user || null,
    layout: "layouts/main",
  });
});

app.use(globalErrorHandler);

module.exports = app;
