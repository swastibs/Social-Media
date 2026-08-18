require("dotenv").config();
const { hash } = require("bcrypt");

const { sequelize, User } = require("../models");
const { ROLES } = require("../constant/role");

const seedAdmin = async () => {
  try {
    await sequelize.authenticate();
    console.log("Connected to DB");

    // Check existing admin

    const adminExists = await User.findOne({
      where: {
        role: ROLES.ADMIN,
        isDeleted: false,
      },
    });

    if (adminExists) {
      console.log("Admin already exists");
      process.exit(0);
    }

    // Create admin

    const hashedPassword = await hash("9898", 10);

    await User.create({
      name: "Admin",
      email: "admin@gmail.com",
      password: hashedPassword,
      role: ROLES.ADMIN,
      isActive: true,
      isDeleted: false,
      deletedBy: null,
    });

    console.log("Admin seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedAdmin();
