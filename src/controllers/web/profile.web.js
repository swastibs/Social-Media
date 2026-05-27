/**
 * Profile Controller (Web)
 *
 * Handles:
 * - Viewing user profile (with privacy and follow logic)
 * - Followers / Following lists
 * - Editing profile (name, bio, profile picture, privacy)
 * - Toggle account privacy (public/private)
 */

const {
  User,
  Post,
  PostLike,
  Comment,
  UserFollow,
  sequelize,
} = require("../../models");
const { ROLES } = require("../../constant/role");
const { Op } = require("sequelize");
const { getSafeUserInclude } = require("../../utils/dbHelper");
const { uploadToMinio, deleteFromMinioByUrl } = require("../../config/minio");
const redirectBack = require("../../utils/redirectBack");
const { deleteByPattern } = require("../../utils/cache");

/**
 * Helper: Get detailed follow relationship status between two users.
 * Returns 'accepted', 'pending', or null.
 */
const getFollowStatus = async (followerId, followingId) => {
  if (!followerId || followerId === followingId) return null;
  const follow = await UserFollow.findOne({
    where: { followerId, followingId },
    attributes: ["status"],
  });
  return follow ? follow.status : null;
};

/**
 * Helper: Check if current user is following target user (accepted only).
 */
const isFollowing = async (followerId, followingId) => {
  const status = await getFollowStatus(followerId, followingId);
  return status === "accepted";
};

/**
 * Helper: Get list of user IDs that a user follows with status = 'accepted'.
 */
const getAcceptedFollowingIds = async (userId) => {
  const follows = await UserFollow.findAll({
    where: { followerId: userId, status: "accepted" },
    attributes: ["followingId"],
    raw: true,
  });
  return follows.map((f) => f.followingId);
};

// ================================
// Render Profile Page
// ================================
exports.renderProfile = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const profileUserId = parseInt(req.params.userId, 10);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 12;
    const offset = (page - 1) * limit;

    const profileUser = await User.findByPk(profileUserId, {
      attributes: [
        "id",
        "name",
        "email",
        "bio",
        "profilePictureUrl",
        "postsCount",
        "followersCount",
        "followingCount",
        "isVerified",
        "isActive",
        "role",
        "isPrivate",
      ],
    });
    if (!profileUser || profileUser.isDeleted) {
      req.flash("error_msg", "User not found");
      return redirectBack(req, res, "/feed");
    }

    let canViewPosts = false;
    let followStatus = null;

    if (
      currentUser &&
      (currentUser.id === profileUserId || currentUser.role === "admin")
    )
      canViewPosts = true;
    else if (!profileUser.isPrivate) canViewPosts = true;
    else {
      if (currentUser) {
        followStatus = await getFollowStatus(currentUser.id, profileUserId);
        if (followStatus === "accepted") canViewPosts = true;
      }
    }

    let posts = [];
    let totalPostsCount = 0;

    if (canViewPosts) {
      const { count, rows } = await Post.findAndCountAll({
        where: { userId: profileUserId, isDeleted: false },
        include: [getSafeUserInclude()],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
        distinct: true,
        subQuery: false,
      });
      totalPostsCount = count;
      const postIds = rows.map((p) => p.id);

      let likedSet = new Set();
      let commentCountMap = {};
      if (currentUser && postIds.length) {
        const likedPosts = await PostLike.findAll({
          where: { userId: currentUser.id, postId: { [Op.in]: postIds } },
          attributes: ["postId"],
          raw: true,
        });
        likedSet = new Set(likedPosts.map((lp) => lp.postId));

        const commentCounts = await Comment.findAll({
          where: { postId: { [Op.in]: postIds }, isDeleted: false },
          attributes: [
            "postId",
            [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          ],
          group: ["postId"],
          raw: true,
        });
        commentCountMap = Object.fromEntries(
          commentCounts.map((cc) => [cc.postId, parseInt(cc.count)]),
        );
      }

      posts = rows.map((post) => ({
        ...post.toJSON(),
        liked: currentUser ? likedSet.has(post.id) : false,
        commentCount: commentCountMap[post.id] || 0,
      }));
    }

    let viewerFollows = false;
    if (currentUser && currentUser.id !== profileUserId)
      viewerFollows = await isFollowing(currentUser.id, profileUserId);

    const actualFollowersCount = await UserFollow.count({
      where: { followingId: profileUserId, status: "accepted" },
    });
    const actualFollowingCount = await UserFollow.count({
      where: { followerId: profileUserId, status: "accepted" },
    });

    profileUser.dataValues.followersCount = actualFollowersCount;
    profileUser.dataValues.followingCount = actualFollowingCount;

    res.render("profile", {
      title: `${profileUser.name} · Profile`,
      user: currentUser,
      currentUser,
      profileUser,
      posts,
      canViewPosts,
      followStatus,
      viewerFollows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPostsCount / limit),
        totalItems: totalPostsCount,
        itemsPerPage: limit,
        hasPrev: page > 1,
        hasNext: page < Math.ceil(totalPostsCount / limit),
      },
      pageCss: ["profile.css", "feed.css"],
    });
  } catch (error) {
    next(error);
  }
};

// ================================
// Render Followers List (users who follow profileUser)
// ================================
exports.renderFollowers = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const profileUserId = parseInt(req.params.userId, 10);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const profileUser = await User.findByPk(profileUserId);
    if (!profileUser || profileUser.isDeleted) {
      req.flash("error_msg", "User not found");
      return redirectBack(req, res, "/feed");
    }

    // Get paginated list of UserFollow records where profileUser is the following (target)
    const { count, rows: follows } = await UserFollow.findAndCountAll({
      where: { followingId: profileUserId, status: "accepted" },
      include: [
        {
          model: User,
          as: "follower",
          attributes: [
            "id",
            "name",
            "email",
            "bio",
            "profilePictureUrl",
            "thumbnailUrl",
            "isVerified",
            "postsCount",
            "followersCount",
          ],
          where: { isDeleted: false, isActive: true, role: ROLES.USER },
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      distinct: true,
    });

    const followers = follows.map((f) => f.follower).filter(Boolean);

    // Build follow status map for current user
    let followStatusMap = {};
    if (currentUser && followers.length) {
      const followerIds = followers.map((f) => f.id);
      const acceptedFollows = await UserFollow.findAll({
        where: {
          followerId: currentUser.id,
          followingId: { [Op.in]: followerIds },
          status: "accepted",
        },
        attributes: ["followingId"],
        raw: true,
      });
      const followingSet = new Set(acceptedFollows.map((f) => f.followingId));
      followStatusMap = Object.fromEntries(
        followerIds.map((id) => [id, followingSet.has(id)]),
      );
    }

    res.render("followers", {
      title: `Followers of ${profileUser.name}`,
      user: currentUser,
      currentUser,
      profileUser,
      users: followers,
      followStatusMap,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        hasPrev: page > 1,
        hasNext: page < Math.ceil(count / limit),
      },
      type: "followers",
      pageCss: "profile.css",
    });
  } catch (error) {
    next(error);
  }
};

// ================================
// Render Following List (users profileUser follows)
// ================================
exports.renderFollowing = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const profileUserId = parseInt(req.params.userId, 10);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const profileUser = await User.findByPk(profileUserId);
    if (!profileUser || profileUser.isDeleted) {
      req.flash("error_msg", "User not found");
      return redirectBack(req, res, "/feed");
    }

    // Get paginated list of UserFollow records where profileUser is the follower
    const { count, rows: follows } = await UserFollow.findAndCountAll({
      where: { followerId: profileUserId, status: "accepted" },
      include: [
        {
          model: User,
          as: "following",
          attributes: [
            "id",
            "name",
            "email",
            "bio",
            "profilePictureUrl",
            "thumbnailUrl",
            "isVerified",
            "postsCount",
            "followersCount",
          ],
          where: { isDeleted: false, isActive: true, role: ROLES.USER },
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      distinct: true,
    });

    const following = follows.map((f) => f.following).filter(Boolean);

    // Build follow status map for current user
    let followStatusMap = {};
    if (currentUser && following.length) {
      const followingIds = following.map((f) => f.id);
      const acceptedFollows = await UserFollow.findAll({
        where: {
          followerId: currentUser.id,
          followingId: { [Op.in]: followingIds },
          status: "accepted",
        },
        attributes: ["followingId"],
        raw: true,
      });
      const followingSet = new Set(acceptedFollows.map((f) => f.followingId));
      followStatusMap = Object.fromEntries(
        followingIds.map((id) => [id, followingSet.has(id)]),
      );
    }

    res.render("following", {
      title: `Users followed by ${profileUser.name}`,
      user: currentUser,
      currentUser,
      profileUser,
      users: following,
      followStatusMap,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        hasPrev: page > 1,
        hasNext: page < Math.ceil(count / limit),
      },
      type: "following",
      pageCss: "profile.css",
    });
  } catch (error) {
    next(error);
  }
};

// ================================
// Render Edit Profile Form
// ================================
exports.renderEditProfile = async (req, res, next) => {
  try {
    const user = req.user;
    res.render("profile-edit", {
      title: "Edit Profile",
      user: user,
      currentUser: user,
      pageCss: "create-edit-post.css",
    });
  } catch (error) {
    next(error);
  }
};

// ================================
// Update Profile (name, bio, picture, privacy)
// ================================
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, bio, removeImage, isPrivate } = req.body;
    const file = req.file;

    const user = await User.findByPk(userId);
    if (!user) {
      req.flash("error_msg", "User not found");
      return res.redirect("/profile/edit");
    }

    if (name) user.name = name.trim();
    if (bio !== undefined) user.bio = bio ? bio.trim() : null;
    if (isPrivate !== undefined)
      user.isPrivate = isPrivate === "true" || isPrivate === true;

    const oldPictureUrl = user.profilePictureUrl;

    if (file) {
      const result = await uploadToMinio(
        file.buffer,
        file.originalname,
        "profiles",
        { thumbnailSize: 80 },
      );
      user.profilePictureUrl = result.url;
      user.thumbnailUrl = result.thumbnailUrl;
    }

    if (removeImage === "true" && user.profilePictureUrl) {
      await deleteFromMinioByUrl(user.profilePictureUrl);
      user.profilePictureUrl = null;
      user.thumbnailUrl = null;
    }

    await user.save();

    // After await user.save()
    await deleteByPattern(`web:cache:/profile/${userId}*`);
    await deleteByPattern("web:cache:/feed*"); // name/bio may appear in feed
    await deleteByPattern("web:cache:/search*");

    if (file && oldPictureUrl) await deleteFromMinioByUrl(oldPictureUrl);

    req.flash("success_msg", "Profile updated successfully");
    res.redirect(`/profile/${userId}`);
  } catch (error) {
    next(error);
  }
};

// ================================
// Toggle account privacy (public/private) via AJAX
// ================================
exports.togglePrivacy = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { isPrivate } = req.body;
    const user = await User.findByPk(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    user.isPrivate = isPrivate === true || isPrivate === "true";
    await user.save();

    // After await user.save()
    await deleteByPattern(`web:cache:/profile/${userId}*`);
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern(`web:cache:/profile/${userId}/followers*`);
    await deleteByPattern(`web:cache:/profile/${userId}/following*`);

    return res.json({ success: true, isPrivate: user.isPrivate });
  } catch (error) {
    next(error);
  }
};
