const path = require("path");
const express = require("express");
const passport = require("passport");
require("dotenv").config();
const swaggerUi = require("swagger-ui-express");
const cookieParser = require("cookie-parser");
const expressLayouts = require("express-ejs-layouts");

require("./src/config/passport");
const indexRoute = require("./src/routes/api/index.route");
const { globalErrorHandler } = require("./src/middlewares/globalErrorHandeler");
const { connectDB } = require("./src/config/db");
const connectMongo = require("./src/config/mongo");
const activityLogger = require("./src/middlewares/activityLogger.middleware");
const webRouter = require("./src/routes/web/web.route");

const app = express();

// view engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));

// simple landing route (temporary)
app.get("/", (req, res) => {
  res.render("landing");
});

connectDB();
connectMongo();

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(require("./src/config/swagger-output.json"), {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));
app.set("layout", "layouts/main");

app.use(passport.initialize());

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
