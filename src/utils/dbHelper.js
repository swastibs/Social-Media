const ApiError = require("./ApiError");
const { User, Post, Comment, UserFollow } = require("../models");
const { ROLES } = require("../constant/role");

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

const getUser = async (userId) => {
  const user = await User.findOne({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new ApiError(404, "User not found");
  return user;
};

const getPost = async (postId) => {
  const post = await Post.findOne({
    where: { id: postId, isDeleted: false },
  });
  if (!post) throw new ApiError(404, "Post not found");
  return post;
};

const getComment = async (commentId) => {
  const comment = await Comment.findOne({
    where: { id: commentId, isDeleted: false },
  });
  if (!comment) throw new ApiError(404, "Comment not found");
  return comment;
};

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
