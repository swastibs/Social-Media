/**
 * PostLoop - Web MVC Edition
 * Main Express application configuration
 *
 * Sets up middleware, view engine, session, Passport,
 * global error handling, and routes.
 */

const path = require("path");
const express = require("express");
const compression = require("compression");
const passport = require("passport");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const flash = require("connect-flash");
const RedisStore = require("connect-redis").default || require("connect-redis");
const redisClient = require("./src/config/redis");

// Configuration imports
require("./src/config/passport");
const { connectDB } = require("./src/config/db");
const connectMongo = require("./src/config/mongo");

// Middleware imports
const activityLogger = require("./src/middlewares/activityLogger.middleware");
const attachUserIfLoggedIn = require("./src/middlewares/attachUser.middleware");
const { globalErrorHandler } = require("./src/middlewares/globalErrorHandeler");

// routes
const webRouter = require("./src/routes/web/web.route");
const apiRouter = require("./src/routes/api/index.route");

const app = express();

// COMPRESSION (gzip)
app.use(compression());

// VIEW ENGINE (EJS)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));

// DATABASE CONNECTIONS
connectDB(); // MySQL (Sequelize)
connectMongo(); // MongoDB (Activity logs)

// STATIC FILES (CSS, JS, images)
app.use(
  express.static(path.join(__dirname, "src/public"), {
    maxAge: "1d",
    immutable: true,
  }),
);

// SESSION & FLASH MESSAGES
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    store: new RedisStore({ client: redisClient }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 24 hours
  }),
);
app.use(flash());

// Make flash messages available in all views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  next();
});

// BODY PARSERS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// EJS LAYOUTS (express-ejs-layouts)
app.use(expressLayouts);
app.set("layout", "layouts/main");

// PASSPORT (JWT strategy + GitHub OAuth)
app.use(passport.initialize());
app.use(passport.session());

// COOKIE PARSER (for reading JWT token)
app.use(cookieParser());

// CUSTOM MIDDLEWARES
// Attach user object if logged in (populates req.user)
app.use(attachUserIfLoggedIn);

// Activity logger (logs POST/PUT/DELETE to MongoDB)
app.use(activityLogger);

// ROUTES (Web only)
app.use("/", webRouter);
app.use("/api", apiRouter);

// 404 HANDLER
app.use((req, res) => {
  // Render error page WITH the main layout (sidebar will appear if user logged in)
  res.status(404).render("error", {
    title: "Page Not Found",
    message: "The page you are looking for does not exist.",
    user: req.user || null,
    layout: "layouts/main",
  });
});

// GLOBAL ERROR HANDLER (must be LAST)
app.use(globalErrorHandler);

module.exports = app;
