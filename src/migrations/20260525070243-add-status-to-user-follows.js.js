// src/migrations/XXXX-add-status-to-user-follows.js
"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("user_follows", "status", {
      type: Sequelize.ENUM("pending", "accepted", "rejected"),
      defaultValue: "accepted", // existing follows become 'accepted'
      allowNull: false,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("user_follows", "status");
    await queryInterface.sequelize.query("DROP TYPE enum_user_follows_status");
  },
};
