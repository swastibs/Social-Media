/**
 * MongoDB Configuration (Mongoose)
 *
 * Establishes connection to MongoDB database for storing activity logs.
 * Uses Mongoose ODM for schema-based modeling.
 */

const mongoose = require("mongoose");

/**
 * Connects to MongoDB using the URI from environment variables.
 * Logs success or failure to the console.
 */
const connectMongo = async () => {
  try {
    const mongoURI =
      process.env.MONGO_URI ||
      "mongodb://postloop-8ofmkfndi-swastisunder-s-projects.vercel.app:27017/postloop";

    await mongoose.connect(mongoURI, {
      // These options are now defaults in newer Mongoose versions, but kept for clarity
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds if server not found
      family: 4, // Use IPv4, skip trying IPv6
    });

    console.log("✅ MongoDB Connected (Activity Logger)");
  } catch (error) {
    console.error("❌ MongoDB Error:", error.message);
    // Do not exit process – activity logging is non‑critical
    // The app will continue running but logs won't be stored
  }
};

module.exports = connectMongo;
