const { sequelize } = require("../../models");
const mongoose = require("mongoose");
const redis = require("../../config/redis");

/**
 * GET /api/health
 * Returns health status of all services
 */
exports.healthCheck = async (req, res) => {
  const start = Date.now();
  const status = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      mysql: { status: "unknown" },
      mongodb: { status: "unknown" },
      redis: { status: "unknown" },
    },
  };

  // Check MySQL
  try {
    await sequelize.authenticate();
    status.services.mysql.status = "ok";
  } catch (err) {
    status.services.mysql.status = "error";
    status.services.mysql.error = err.message;
  }

  // Check MongoDB
  try {
    const state = mongoose.connection.readyState;
    if (state === 1) {
      status.services.mongodb.status = "ok";
    } else {
      status.services.mongodb.status = "disconnected";
    }
  } catch (err) {
    status.services.mongodb.status = "error";
    status.services.mongodb.error = err.message;
  }

  // Check Redis
  try {
    const pong = await redis.ping();
    if (pong === "PONG") {
      status.services.redis.status = "ok";
    } else {
      status.services.redis.status = "error";
    }
  } catch (err) {
    status.services.redis.status = "error";
    status.services.redis.error = err.message;
  }

  const allOk =
    status.services.mysql.status === "ok" &&
    status.services.mongodb.status === "ok" &&
    status.services.redis.status === "ok";

  status.success = allOk;
  status.responseTime = Date.now() - start;

  // Return 200 if all services are healthy, otherwise 503
  const httpStatus = allOk ? 200 : 503;
  res.status(httpStatus).json(status);
};
