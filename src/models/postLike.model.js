const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const PostLike = sequelize.define(
  "PostLike",
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    tableName: "post_likes",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["userId", "postId"] },
      { fields: ["postId"] },
    ],
  },
);

module.exports = PostLike;
