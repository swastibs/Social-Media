const ApiError = require("./ApiError");
const { User, Post, Comment } = require("../models");
const { ROLES } = require("../constant/role");

/**
 * Returns a Sequelize include object for the User model that automatically
 * excludes admin users from public responses (API and non‑admin views).
 * Admin controllers may override this by not using this helper.
 *
 * @param {Object} options
 * @param {string[]} options.attributes - Attributes to include (default: ["id", "name", "profilePictureUrl"])
 * @returns {Object} Sequelize include object
 */
const getSafeUserInclude = (options = {}) => {
  const { attributes = ["id", "name", "profilePictureUrl"] } = options;
  return {
    model: User,
    attributes,
    where: {
      role: ROLES.USER, // Exclude admin users
      isDeleted: false,
      isActive: true,
    },
    required: true, // Only return records that have a valid user
  };
};

exports.getSafeUserInclude = getSafeUserInclude;

/**
 * Fetch a user by ID, throwing an ApiError if not found or soft‑deleted.
 */
exports.getUser = async (userId) => {
  const user = await User.findOne({
    where: { id: userId, isDeleted: false },
  });

  if (!user) throw new ApiError(404, "User not found");

  return user;
};

/**
 * Fetch a post by ID, throwing an ApiError if not found or soft‑deleted.
 */
exports.getPost = async (postId) => {
  const post = await Post.findOne({
    where: { id: postId, isDeleted: false },
  });

  if (!post) throw new ApiError(404, "Post not found");

  return post;
};

/**
 * Fetch a comment by ID, throwing an ApiError if not found or soft‑deleted.
 */
exports.getComment = async (commentId) => {
  const comment = await Comment.findOne({
    where: { id: commentId, isDeleted: false },
  });

  if (!comment) throw new ApiError(404, "Comment not found");

  return comment;
};
