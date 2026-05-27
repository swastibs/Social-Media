/**
 * Feed Controller (Web)
 *
 * Renders the main feed page showing posts from:
 * - Users that the current user follows (accepted)
 * - Public users (isPrivate = false) that the user does NOT follow
 *
 * Also provides suggested users and real-time follow/like interactions.
 */

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

/**
 * Helper: Get all public user IDs (isPrivate = false, active, not deleted, role = user).
 * Excludes given IDs (self + already followed).
 */
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

/**
 * Core feed posts retrieval.
 * Combines posts from:
 *   1. Users that current user follows (status = accepted)
 *   2. Public users (isPrivate = false) that current user does NOT follow (and not themselves)
 */
const getFeedPosts = async (
  currentUserId,
  limit,
  offset,
  acceptedFollowingIds,
) => {
  // 1. Get all public user IDs (excluding current user and already followed)
  const excludeFromPublic = [...acceptedFollowingIds, currentUserId];
  const publicUserIds = await getPublicUserIds(excludeFromPublic);

  // 2. Build WHERE clause for posts:
  //    - userId IN acceptedFollowingIds  OR
  //    - userId IN publicUserIds
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

  // 3. Enrich with like status and comment counts
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

/**
 * Render the main feed page.
 */
exports.renderFeed = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 12;
    const offset = (page - 1) * limit;

    // Only accepted follows matter for feed
    const acceptedFollowingIds = await getAcceptedFollowingIds(currentUser.id);
    let posts = await getFeedPosts(
      currentUser.id,
      limit,
      offset,
      acceptedFollowingIds,
    );

    // Count total posts that would be visible (for pagination)
    const publicUserIds = await getPublicUserIds([
      ...acceptedFollowingIds,
      currentUser.id,
    ]);
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

    // ----- Determine follow status for post authors (to show "Follow" / "Following" button) -----
    const authorIds = [
      ...new Set(
        posts.map((p) => p.userId).filter((id) => id && id !== currentUser.id),
      ),
    ];
    let followStatusMap = {};
    if (authorIds.length) {
      // Check for accepted follows (only accepted counts as "Following")
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
    posts = posts.map((post) => ({
      ...post,
      isFollowing: followStatusMap[post.userId] || false,
    }));

    // ----- Suggested users (exclude accepted follows and self, also exclude private users) -----
    const excludeSuggestionIds = [...acceptedFollowingIds, currentUser.id];
    const suggestedUsers = await User.findAll({
      where: {
        id: { [Op.notIn]: excludeSuggestionIds },
        isDeleted: false,
        isActive: true,
        role: ROLES.USER,
        isPrivate: false, // only suggest public users
      },
      attributes: ["id", "name", "profilePictureUrl", "bio", "isVerified"],
      limit: 10,
      order: sequelize.random(),
    });

    // Fetch current user with counts for sidebar
    const userWithCounts = await User.findByPk(currentUser.id, {
      attributes: [
        "id",
        "name",
        "email",
        "bio",
        "isVerified",
        "profilePictureUrl",
        "thumbnailUrl",
        "postsCount",
        "followersCount",
        "followingCount",
      ],
    });

    res.render("feed", {
      title: "Feed",
      user: userWithCounts,
      currentUser: userWithCounts,
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
