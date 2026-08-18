const {
  User,
  Post,
  UserFollow,
  PostLike,
  Comment,
  sequelize,
} = require("../../models");
const { ROLES } = require("../../constant/role");
const { Op } = require("sequelize");
const {
  getSafeUserInclude,
  getAcceptedFollowingIds,
} = require("../../utils/dbHelper");
const { successResponse } = require("../../utils/ApiResponse");
const { setCache } = require("../../utils/cache");

const getPublicUserIds = async (excludeIds = []) => {
  const users = await User.findAll({
    where: {
      isPrivate: false,
      isDeleted: false,
      isActive: true,
      role: ROLES.USER,
      id: { [Op.notIn]: excludeIds },
    },
    attributes: ["id"],
    raw: true,
  });
  return users.map((u) => u.id);
};

const getFeedPosts = async (
  currentUserId,
  limit,
  offset,
  acceptedFollowingIds,
) => {
  const excludeFromPublic = [...acceptedFollowingIds, currentUserId];
  const publicUserIds = await getPublicUserIds(excludeFromPublic);

  const userIdCondition = {
    [Op.or]: [
      { userId: { [Op.in]: acceptedFollowingIds } },
      { userId: { [Op.in]: publicUserIds } },
    ],
  };

  const posts = await Post.findAll({
    where: {
      ...userIdCondition,
      isDeleted: false,
    },
    include: [getSafeUserInclude()],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  const postIds = posts.map((p) => p.id);
  const likedPosts = await PostLike.findAll({
    where: { userId: currentUserId, postId: { [Op.in]: postIds } },
    attributes: ["postId"],
    raw: true,
  });
  const likedSet = new Set(likedPosts.map((lp) => lp.postId));

  const commentCounts = await Comment.findAll({
    where: { postId: { [Op.in]: postIds }, isDeleted: false },
    attributes: [
      "postId",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    group: ["postId"],
    raw: true,
  });
  const commentMap = Object.fromEntries(
    commentCounts.map((cc) => [cc.postId, parseInt(cc.count)]),
  );

  return posts.map((post) => ({
    ...post.toJSON(),
    liked: likedSet.has(post.id),
    commentCount: commentMap[post.id] || 0,
  }));
};

exports.getFeed = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 12;
    const offset = (page - 1) * limit;

    const acceptedFollowingIds = await getAcceptedFollowingIds(currentUser.id);
    let posts = await getFeedPosts(
      currentUser.id,
      limit,
      offset,
      acceptedFollowingIds,
    );

    const excludeFromPublic = [...acceptedFollowingIds, currentUser.id];
    const publicUserIds = await getPublicUserIds(excludeFromPublic);
    const totalPostsCount = await Post.count({
      where: {
        [Op.or]: [
          { userId: { [Op.in]: acceptedFollowingIds } },
          { userId: { [Op.in]: publicUserIds } },
        ],
        isDeleted: false,
      },
    });
    const totalPages = Math.ceil(totalPostsCount / limit);

    const authorIds = [
      ...new Set(
        posts.map((p) => p.userId).filter((id) => id && id !== currentUser.id),
      ),
    ];
    let followStatusMap = {};
    if (authorIds.length) {
      const acceptedFollows = await UserFollow.findAll({
        where: {
          followerId: currentUser.id,
          followingId: { [Op.in]: authorIds },
          status: "accepted",
        },
        attributes: ["followingId"],
        raw: true,
      });
      const acceptedSet = new Set(acceptedFollows.map((f) => f.followingId));
      followStatusMap = Object.fromEntries(
        authorIds.map((id) => [id, acceptedSet.has(id)]),
      );
    }
    const enrichedPosts = posts.map((post) => ({
      ...post,
      isFollowing: followStatusMap[post.userId] || false,
    }));
    posts = null;
    followStatusMap = null;

    const excludeSuggestionIds = [...acceptedFollowingIds, currentUser.id];
    const suggestedUsers = await User.findAll({
      where: {
        id: { [Op.notIn]: excludeSuggestionIds },
        isDeleted: false,
        isActive: true,
        role: ROLES.USER,
        isPrivate: false,
      },
      attributes: [
        "id",
        "name",
        "profilePictureUrl",
        "thumbnailUrl",
        "bio",
        "isVerified",
      ],
      limit: 10,
      order: sequelize.random(),
    });

    let responsePayload = {
      success: true,
      message: "Feed fetched successfully",
      data: {
        posts: enrichedPosts,
        suggestedUsers,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalPostsCount,
          itemsPerPage: limit,
          hasPrev: page > 1,
          hasNext: page < totalPages,
        },
      },
    };

    if (req.cacheKey) {
      await setCache(req.cacheKey, responsePayload);
    }

    const responseResult = successResponse(res, responsePayload);
    responsePayload = null;
    return responseResult;
  } catch (error) {
    next(error);
  }
};
