"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add resetPasswordToken column
    await queryInterface.addColumn("users", "resetPasswordToken", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add resetPasswordExpires column
    await queryInterface.addColumn("users", "resetPasswordExpires", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove columns if we rollback
    await queryInterface.removeColumn("users", "resetPasswordToken");
    await queryInterface.removeColumn("users", "resetPasswordExpires");
  },
};
