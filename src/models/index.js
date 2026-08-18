/**
 * Models Index
 *
 * Exports all Sequelize models and sets up associations.
 */

const { sequelize } = require("../config/db");

const User = require("./user.model");
const Post = require("./post.model");
const Comment = require("./comment.model");
const PostLike = require("./postLike.model");
const UserFollow = require("./userFollow.model");
const Payment = require("./payment.model");

// ========== User → Post ==========
User.hasMany(Post, { foreignKey: "userId" });
Post.belongsTo(User, { foreignKey: "userId" });

// ========== User → Comment ==========
User.hasMany(Comment, { foreignKey: "userId" });
Comment.belongsTo(User, { foreignKey: "userId" });

// ========== Post → Comment ==========
Post.hasMany(Comment, { foreignKey: "postId" });
Comment.belongsTo(Post, { foreignKey: "postId" });

// ========== DeletedBy references (no index) ==========
Post.belongsTo(User, {
  foreignKey: "deletedBy",
  as: "deletedByUser",
  constraints: false,
});
Comment.belongsTo(User, {
  foreignKey: "deletedBy",
  as: "deletedByUser",
  constraints: false,
});
User.belongsTo(User, {
  foreignKey: "deletedBy",
  as: "deletedByUser",
  constraints: false,
});

// ========== Many-to-Many: Post Likes ==========
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

// ========== User Follow System ==========
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

UserFollow.belongsTo(User, { foreignKey: "followerId", as: "follower" });
UserFollow.belongsTo(User, { foreignKey: "followingId", as: "following" });
User.hasMany(UserFollow, { foreignKey: "followerId", as: "followRelations" });
User.hasMany(UserFollow, {
  foreignKey: "followingId",
  as: "followedRelations",
});

// ========== Payments ==========
User.hasMany(Payment, { foreignKey: "userId" });
Payment.belongsTo(User, { foreignKey: "userId" });

module.exports = {
  sequelize,
  User,
  Post,
  Comment,
  PostLike,
  UserFollow,
  Payment,
};
