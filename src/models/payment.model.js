const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Payment = sequelize.define(
  "Payment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    razorpayOrderId: { type: DataTypes.STRING, allowNull: false, unique: true },
    razorpayPaymentId: { type: DataTypes.STRING, allowNull: true },
    razorpaySignature: { type: DataTypes.TEXT, allowNull: true },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Amount in paise",
    },
    currency: { type: DataTypes.STRING, defaultValue: "INR" },
    status: {
      type: DataTypes.ENUM("created", "attempted", "paid", "failed"),
      defaultValue: "created",
    },
    paymentMethod: { type: DataTypes.STRING, allowNull: true },
    paymentDetails: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Store JSON response from Razorpay",
    },
  },
  {
    tableName: "payments",
    timestamps: true,
    indexes: [
      { fields: ["userId"] },
      { fields: ["razorpayOrderId"] },
      { fields: ["status"] },
    ],
  },
);

module.exports = Payment;
