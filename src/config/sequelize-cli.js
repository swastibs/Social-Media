/**
 * Sequelize CLI Configuration
 *
 * This file is used by the Sequelize CLI tool (npx sequelize-cli) for:
 * - Migrations (npx sequelize-cli db:migrate)
 * - Seeders (npx sequelize-cli db:seed:all)
 * - Generating models/migrations
 *
 * It loads environment variables from .env for different environments.
 */

require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "123",
    database: process.env.DB_NAME || "postloop",
    host: process.env.DB_HOST || "localhost",
    dialect: "mysql",
    logging: false,
  },
  test: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "123",
    database: (process.env.DB_NAME || "postloop") + "_test",
    host: process.env.DB_HOST || "localhost",
    dialect: "mysql",
    logging: false,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
};
