const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "postloop",
  process.env.DB_USER || "root",
  process.env.DB_PASS || "123",
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    dialect: "mysql",
    logging: false,
    dialectOptions: {
      ssl:
        process.env.DB_SSL === "true" ||
        (process.env.DB_HOST &&
          !/^(localhost|127\.0\.0\.1)$/i.test(process.env.DB_HOST))
          ? {
              require: true,
              rejectUnauthorized: false,
            }
          : false,
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  },
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL Connected successfully");

    await sequelize.sync({ alter: false, force: false });
    console.log("📦 Database schema synchronized");
  } catch (error) {
    console.error("❌ DB Connection Failed:", error.message);

    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
