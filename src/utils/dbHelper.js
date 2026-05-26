/**
 * Database Helper Utilities
 *
 * Provides reusable functions for safely fetching entities with error handling,
 * building user include options for queries, and retrieving accepted follow lists.
 */

const ApiError = require("./ApiError");
const { User, Post, Comment, UserFollow } = require("../models");
const { ROLES } = require("../constant/role");

/**
 * Returns a Sequelize include object for fetching only safe user attributes.
 * Excludes sensitive fields and filters out deleted/inactive users.
 * @param {Object} options - { attributes: [...] }
 * @returns {Object} - Sequelize include object
 */
const getSafeUserInclude = (options = {}) => {
  const {
    attributes = [
      "id",
      "name",
      "profilePictureUrl",
      "thumbnailUrl",
      "isVerified",
      "isPrivate",
    ],
  } = options;
  return {
    model: User,
    attributes,
    where: {
      role: ROLES.USER,
      isDeleted: false,
      isActive: true,
    },
    required: true,
  };
};

/**
 * Fetches a user by ID, throws ApiError if not found or soft-deleted.
 * @param {number} userId - User ID
 * @returns {Promise<User>} - Sequelize User instance
 */
const getUser = async (userId) => {
  const user = await User.findOne({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new ApiError(404, "User not found");
  return user;
};

/**
 * Fetches a post by ID, throws ApiError if not found or soft-deleted.
 * @param {number} postId - Post ID
 * @returns {Promise<Post>} - Sequelize Post instance
 */
const getPost = async (postId) => {
  const post = await Post.findOne({
    where: { id: postId, isDeleted: false },
  });
  if (!post) throw new ApiError(404, "Post not found");
  return post;
};

/**
 * Fetches a comment by ID, throws ApiError if not found or soft-deleted.
 * @param {number} commentId - Comment ID
 * @returns {Promise<Comment>} - Sequelize Comment instance
 */
const getComment = async (commentId) => {
  const comment = await Comment.findOne({
    where: { id: commentId, isDeleted: false },
  });
  if (!comment) throw new ApiError(404, "Comment not found");
  return comment;
};

/**
 * Returns array of user IDs that the given user follows with status 'accepted'.
 * @param {number} userId - Follower user ID
 * @returns {Promise<number[]>} - Array of followed user IDs
 */
const getAcceptedFollowingIds = async (userId) => {
  const follows = await UserFollow.findAll({
    where: { followerId: userId, status: "accepted" },
    attributes: ["followingId"],
    raw: true,
  });
  return follows.map((f) => f.followingId);
};

module.exports = {
  getSafeUserInclude,
  getUser,
  getPost,
  getComment,
  getAcceptedFollowingIds,
};
