require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "123",
    database: process.env.DB_NAME || "postloop",
    host: process.env.DB_HOST || "localhost",
    dialect: "mysql",
  },
  test: {
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "123",
    database: process.env.DB_NAME + "_test" || "postloop_test",
    host: process.env.DB_HOST || "localhost",
    dialect: "mysql",
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "mysql",
  },
};
