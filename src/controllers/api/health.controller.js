const { sequelize } = require("../../models");
const mongoose = require("mongoose");
const redis = require("../../config/redis");

const formatUptime = (seconds) => {
  let remaining = Math.floor(seconds);
  const years = Math.floor(remaining / (365 * 24 * 60 * 60));
  remaining %= 365 * 24 * 60 * 60;
  const days = Math.floor(remaining / 86400);
  remaining %= 86400;
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const parts = [];
  if (years) parts.push(`${years}y`);
  if (days || years) parts.push(`${days}d`);
  if (hours || days || years) parts.push(`${hours}h`);
  if (minutes || hours || days || years) parts.push(`${minutes}min`);
  parts.push(`${secs}sec`);

  return parts.join(", ");
};

exports.healthCheck = async (req, res) => {
  const start = Date.now();

  const status = {
    uptime: formatUptime(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      mysql: { status: "unknown" },
      mongodb: { status: "unknown" },
      redis: { status: "unknown" },
    },
  };

  try {
    await sequelize.authenticate();
    status.services.mysql.status = "ok";
  } catch (err) {
    status.services.mysql.status = "error";
    status.services.mysql.error = err.message;
  }

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

  const httpStatus = allOk ? 200 : 503;
  res.status(httpStatus).json(status);
};
