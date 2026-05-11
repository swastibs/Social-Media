const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Comment = sequelize.define(
  "Comment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    content: { type: DataTypes.TEXT, allowNull: false },

    userId: { type: DataTypes.INTEGER, allowNull: false },

    postId: { type: DataTypes.INTEGER, allowNull: false },

    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },

    deletedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "comments",
    timestamps: true,

    indexes: [
      { fields: ["userId"] },
      { fields: ["postId"] },
      { fields: ["isDeleted"] },
      { fields: ["createdAt"], order: [["createdAt", "DESC"]] },
      { fields: ["postId", "isDeleted"] },
    ],
  },
);

module.exports = Comment;
