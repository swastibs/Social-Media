const schedule = require("node-schedule");
const mongoose = require("mongoose");
const Activity = require("../models/activity.model");

const cronRule = "0 2 * * *";

const cleanupJob = schedule.scheduleJob(cronRule, async () => {
  const start = Date.now();
  console.log(
    `[${new Date().toISOString()}] Starting daily cleanup of activities older than 3 months...`,
  );

  if (mongoose.connection.readyState !== 1) {
    console.error("[Cleanup Job] MongoDB not connected, aborting.");
    return;
  }

  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);

    const result = await Activity.deleteMany({ createdAt: { $lt: cutoff } });
    console.log(
      `[${new Date().toISOString()}] Cleanup finished. Deleted ${result.deletedCount} documents older than ${cutoff.toISOString()}. Duration: ${Date.now() - start}ms`,
    );
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Cleanup failed:`, err);
  }
});

console.log(
  `Cleanup job scheduled: ${cronRule} (next run: ${cleanupJob.nextInvocation()})`,
);

module.exports = cleanupJob;
