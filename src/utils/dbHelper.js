const ApiError = require("./ApiError");
const { User, Post, Comment } = require("../models");
const { ROLES } = require("../constant/role");

const getSafeUserInclude = (options = {}) => {
  const { attributes = ["id", "name", "profilePictureUrl", "isVerified"] } =
    options;
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
