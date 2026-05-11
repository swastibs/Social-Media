const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const UserFollow = sequelize.define(
  "UserFollow",
  {
    followerId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },

    followingId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
  },
  {
    tableName: "user_follows",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["followerId", "followingId"] },
      { fields: ["followerId"] },
      { fields: ["followingId"] },
    ],
  },
);

module.exports = UserFollow;
