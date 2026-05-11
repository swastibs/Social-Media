const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    userId: { type: Number, default: null, index: true },

    method: {
      type: String,
      required: true,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      index: true,
    },

    route: { type: String, required: true, index: true },

    ip: { type: String, default: null },

    requestTime: { type: Date, default: Date.now },

    responseStatus: { type: Number, default: null, index: true },

    responseTime: { type: Number, default: null },

    message: { type: String, default: null },

    entity: { type: String, default: null, index: true },

    entityId: { type: Number, default: null, index: true },

    oldData: { type: mongoose.Schema.Types.Mixed, default: null },

    newData: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

activitySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 },
);

module.exports = mongoose.model("Activity", activitySchema);
