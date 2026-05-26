/**
 * Database Configuration (MySQL / Sequelize)
 *
 * Establishes and manages the connection to the MySQL database
 * using Sequelize ORM. Exports both the sequelize instance and
 * a connectDB function for application initialization.
 */

const { Sequelize } = require("sequelize");

// Create Sequelize instance with credentials from .env
const sequelize = new Sequelize(
  process.env.DB_NAME || "postloop",
  process.env.DB_USER || "root",
  process.env.DB_PASS || "123",
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "mysql",
    logging: false, // Disable SQL query logging in console (optional: set to console.log for debugging)
    pool: {
      max: 10, // Maximum number of connection in pool
      min: 0, // Minimum number of connection in pool
      acquire: 30000, // Maximum time (ms) to acquire connection before throwing error
      idle: 10000, // Maximum time (ms) a connection can be idle before being released
    },
  },
);

/**
 * Connects to MySQL database and syncs models.
 * Note: In production, use migrations instead of sync({ force: false }).
 * We keep sync() only to ensure tables exist during development.
 */
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL Connected successfully");

    // Sync all models (creates tables if they don't exist)
    // Set { force: false } to avoid dropping existing tables
    await sequelize.sync({ alter: false, force: false });
    console.log("📦 Database schema synchronized");
  } catch (error) {
    console.error("❌ DB Connection Failed:", error.message);
    // Exit process if database connection fails (critical)
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
