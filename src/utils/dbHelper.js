const ApiError = require("./ApiError");
const { User, Post, Comment } = require("../models");
const { ROLES } = require("../constant/role");

/**
 * Get a safe User include object for Sequelize queries.
 * This automatically excludes admin users from any included User model.
 * Use this in all queries that include User model to prevent admin data leakage.
 *
 * @param {object} options - Options for the include
 * @param {string[]} options.attributes - Attributes to include (default: ["id", "name"])
 * @returns {object} Sequelize include object for User model
 */
const getSafeUserInclude = (options = {}) => {
  const { attributes = ["id", "name"] } = options;
  return {
    model: User,
    attributes,
    where: {
      role: ROLES.USER, // Exclude admin users from all responses
      isDeleted: false,
      isActive: true,
    },
    required: true, // Only include posts/comments where user passes the filter
  };
};

exports.getSafeUserInclude = getSafeUserInclude;

exports.getUser = async (userId) => {
  const user = await User.findOne({
    where: { id: userId, isDeleted: false },
  });

  if (!user) throw new ApiError(404, "User not found");

  return user;
};

exports.getPost = async (postId) => {
  const post = await Post.findOne({
    where: { id: postId, isDeleted: false },
  });

  if (!post) throw new ApiError(404, "Post not found");

  return post;
};

exports.getComment = async (commentId) => {
  const comment = await Comment.findOne({
    where: { id: commentId, isDeleted: false },
  });

  if (!comment) throw new ApiError(404, "Comment not found");

  return comment;
};
