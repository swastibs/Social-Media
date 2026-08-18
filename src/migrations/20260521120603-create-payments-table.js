"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("payments", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      razorpayOrderId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      razorpayPaymentId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      razorpaySignature: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Amount in paise",
      },
      currency: {
        type: Sequelize.STRING,
        defaultValue: "INR",
      },
      status: {
        type: Sequelize.ENUM("created", "attempted", "paid", "failed"),
        defaultValue: "created",
      },
      paymentMethod: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      paymentDetails: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Store JSON response from Razorpay",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("payments", ["userId"]);
    await queryInterface.addIndex("payments", ["razorpayOrderId"]);
    await queryInterface.addIndex("payments", ["status"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("payments");
  },
};
