const Activity = require("../models/activity.model");

const activityLogger = (req, res, next) => {
  const start = Date.now();

  let responseBody;

  const oldJson = res.json;

  res.json = function (data) {
    responseBody = data;
    return oldJson.call(this, data);
  };

  res.on("finish", async () => {
    try {
      const methodsToLog = ["POST", "PUT", "PATCH", "DELETE"];
      if (!methodsToLog.includes(req.method)) return;

      const log = {
        userId: req.user ? req.user.id : null,
        method: req.method,
        route: req.originalUrl,
        ip: req.ip,
        requestTime: new Date(start),
        responseStatus: res.statusCode,
        responseTime: Date.now() - start,
        message: responseBody?.message || null,

        entity: null,
        entityId: null,
        oldData: null,
        newData: null,
      };

      if (["PUT", "PATCH"].includes(req.method) && req.activity) {
        log.entity = req.activity.entity;
        log.entityId = req.activity.entityId;
        log.oldData = req.activity.oldData;
        log.newData = req.activity.newData;
      }

      if (["POST", "DELETE"].includes(req.method) && req.activity) {
        log.entity = req.activity.entity;
        log.entityId = req.activity.entityId;
      }

      await Activity.create(log);
    } catch (err) {
      console.log("Log Error:", err.message);
    }
  });

  next();
};

module.exports = activityLogger;
