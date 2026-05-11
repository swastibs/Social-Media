const { sequelize } = require("../config/db");

const User = require("./user.model");
const Post = require("./post.model");
const Comment = require("./comment.model");
const PostLike = require("./postLike.model");
const UserFollow = require("./userFollow.model");

// User → Post
User.hasMany(Post, { foreignKey: "userId" });
Post.belongsTo(User, { foreignKey: "userId" });

// User → Comment
User.hasMany(Comment, { foreignKey: "userId" });
Comment.belongsTo(User, { foreignKey: "userId" });

// Post → Comment
Post.hasMany(Comment, { foreignKey: "postId" });
Comment.belongsTo(Post, { foreignKey: "postId" });

// Post → DeletedBy
Post.belongsTo(User, { foreignKey: "deletedBy", as: "deletedByUser" });

// Comment → DeletedBy
Comment.belongsTo(User, { foreignKey: "deletedBy", as: "deletedByUser" });

// User self-reference (deletedBy in User model)
User.belongsTo(User, { foreignKey: "deletedBy", as: "deletedByUser" });

// Many-to-Many (likes)
User.belongsToMany(Post, {
  through: PostLike,
  foreignKey: "userId",
  as: "likedPosts",
});

Post.belongsToMany(User, {
  through: PostLike,
  foreignKey: "postId",
  as: "likedUsers",
});

// User Follow System
User.belongsToMany(User, {
  through: UserFollow,
  as: "followers",
  foreignKey: "followingId",
  otherKey: "followerId",
});

User.belongsToMany(User, {
  through: UserFollow,
  as: "following",
  foreignKey: "followerId",
  otherKey: "followingId",
});

module.exports = { sequelize, User, Post, Comment, PostLike, UserFollow };
