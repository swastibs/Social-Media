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
const { getSafeUserInclude } = require("../../utils/dbHelper");

const getFollowingIds = async (userId) => {
  const follows = await UserFollow.findAll({
    where: { followerId: userId },
    attributes: ["followingId"],
    raw: true,
  });
  return follows.map((f) => f.followingId);
};

const getFeedPosts = async (currentUserId, limit, offset, followingIds) => {
  const excludeIds = [...followingIds, currentUserId];
  const whereClause =
    followingIds.length === 0
      ? { userId: { [Op.notIn]: excludeIds }, isDeleted: false }
      : {
          [Op.or]: [
            { userId: { [Op.in]: followingIds }, isDeleted: false },
            { userId: { [Op.notIn]: excludeIds }, isDeleted: false },
          ],
        };

  const posts = await Post.findAll({
    where: whereClause,
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

exports.renderFeed = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 12;
    const offset = (page - 1) * limit;

    const followingIds = await getFollowingIds(currentUser.id);
    let posts = await getFeedPosts(currentUser.id, limit, offset, followingIds);
    const totalPostsCount = await Post.count({ where: { isDeleted: false } });
    const totalPages = Math.ceil(totalPostsCount / limit);

    // ----- ADD FOLLOW STATUS TO POST AUTHORS -----
    const authorIds = [
      ...new Set(
        posts.map((p) => p.userId).filter((id) => id && id !== currentUser.id),
      ),
    ];
    let followStatusMap = {};
    if (authorIds.length) {
      const follows = await UserFollow.findAll({
        where: {
          followerId: currentUser.id,
          followingId: { [Op.in]: authorIds },
        },
        attributes: ["followingId"],
        raw: true,
      });
      const followingSet = new Set(follows.map((f) => f.followingId));
      followStatusMap = Object.fromEntries(
        authorIds.map((id) => [id, followingSet.has(id)]),
      );
    }
    posts = posts.map((post) => ({
      ...post,
      isFollowing: followStatusMap[post.userId] || false,
    }));
    // ---------------------------------------------

    const excludeSuggestionIds = [...followingIds, currentUser.id];
    const suggestedUsers = await User.findAll({
      where: {
        id: { [Op.notIn]: excludeSuggestionIds },
        isDeleted: false,
        isActive: true,
        role: ROLES.USER,
      },
      attributes: ["id", "name", "profilePictureUrl", "bio"],
      limit: 10,
      order: sequelize.random(),
    });

    const userWithCounts = await User.findByPk(currentUser.id, {
      attributes: [
        "id",
        "name",
        "email",
        "bio",
        "profilePictureUrl",
        "postsCount",
        "followersCount",
        "followingCount",
      ],
    });

    res.render("feed", {
      title: "Feed",
      user: userWithCounts,
      currentUser: userWithCounts, // pass for the partial
      suggestedUsers,
      posts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalPostsCount,
        itemsPerPage: limit,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      pageCss: "feed.css",
    });
  } catch (error) {
    next(error);
  }
};
