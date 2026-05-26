/**
 * Scheduled Job: Cleanup Old Activities
 *
 * Runs daily at 2:00 AM to delete activity logs older than 3 months
 * from MongoDB. Uses node-schedule for cron scheduling.
 */

const schedule = require("node-schedule");
const mongoose = require("mongoose");
const Activity = require("../models/activity.model");

// Cron pattern: 0 2 * * *  (at 02:00 every day)
const cronRule = "0 2 * * *";

const cleanupJob = schedule.scheduleJob(cronRule, async () => {
  const start = Date.now();
  console.log(
    `[${new Date().toISOString()}] Starting daily cleanup of activities older than 3 months...`,
  );

  // Ensure MongoDB is connected before proceeding
  if (mongoose.connection.readyState !== 1) {
    console.error("[Cleanup Job] MongoDB not connected, aborting.");
    return;
  }

  try {
    // Calculate cutoff date: 3 months ago from now
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);

    // Delete all documents with createdAt older than cutoff
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
