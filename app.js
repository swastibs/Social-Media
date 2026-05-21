const path = require("path");
const express = require("express");
const compression = require("compression");
const passport = require("passport");
require("dotenv").config();
const swaggerUi = require("swagger-ui-express");
const cookieParser = require("cookie-parser");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const flash = require("connect-flash");

require("./src/config/passport");
const indexRoute = require("./src/routes/api/index.route");
const { globalErrorHandler } = require("./src/middlewares/globalErrorHandeler");
const { connectDB } = require("./src/config/db");
const connectMongo = require("./src/config/mongo");
const activityLogger = require("./src/middlewares/activityLogger.middleware");
const webRouter = require("./src/routes/web/web.route");
const { razorpayWebhook } = require("./src/controllers/api/payment.controller");

require("./src/jobs/cleanupActivities");

const app = express();
app.use(compression());

// view engine setup
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
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(require("./src/config/swagger-output.json"), {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
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

// ✅ Razorpay webhook – must be placed BEFORE express.json()
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

// Global JSON parser (after webhook)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(expressLayouts);
app.set("layout", "layouts/main");

app.use(passport.initialize());
app.use(passport.session());

app.use(cookieParser());
app.use(activityLogger);

app.use("/", webRouter);
app.use("/api", indexRoute);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
  });
});

app.use(globalErrorHandler);

module.exports = app;
