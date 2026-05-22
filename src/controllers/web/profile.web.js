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

// Helper to check if currentUser follows targetUser
const isFollowing = async (currentUserId, targetUserId) => {
  if (!currentUserId) return false;
  const follow = await UserFollow.findOne({
    where: { followerId: currentUserId, followingId: targetUserId },
  });
  return !!follow;
};

// Render profile page
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
      ],
    });
    if (!profileUser || profileUser.isDeleted) {
      req.flash("error_msg", "User not found");
      return redirectBack(req, res, "/feed");
    }

    const { count, rows: posts } = await Post.findAndCountAll({
      where: { userId: profileUserId, isDeleted: false },
      include: [getSafeUserInclude()],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
      subQuery: false,
    });

    const postIds = posts.map((p) => p.id);
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

    const postsWithMeta = posts.map((post) => ({
      ...post.toJSON(),
      liked: currentUser ? likedSet.has(post.id) : false,
      commentCount: commentCountMap[post.id] || 0,
    }));

    let follows = false;
    if (currentUser && currentUser.id !== profileUserId) {
      follows = await isFollowing(currentUser.id, profileUserId);
    }

    res.render("profile", {
      title: `${profileUser.name} · Profile`,
      user: currentUser,
      currentUser,
      profileUser,
      posts: postsWithMeta,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: limit,
        hasPrev: page > 1,
        hasNext: page < Math.ceil(count / limit),
      },
      follows,
      pageCss: ["profile.css", "feed.css"],
    });
  } catch (error) {
    next(error);
  }
};

// Render followers list
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

    const { count, rows: followers } = await User.findAndCountAll({
      where: { isDeleted: false, isActive: true, role: ROLES.USER },
      include: [
        {
          model: User,
          as: "following",
          where: { id: profileUserId },
          through: { attributes: [] },
          attributes: [],
        },
      ],
      limit,
      offset,
      distinct: true,
      subQuery: false,
    });

    let followStatusMap = {};
    if (currentUser && followers.length) {
      const followerIds = followers.map((f) => f.id);
      const follows = await UserFollow.findAll({
        where: {
          followerId: currentUser.id,
          followingId: { [Op.in]: followerIds },
        },
        attributes: ["followingId"],
        raw: true,
      });
      const followingSet = new Set(follows.map((f) => f.followingId));
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

// Render following list
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

    const { count, rows: following } = await User.findAndCountAll({
      where: { isDeleted: false, isActive: true, role: ROLES.USER },
      include: [
        {
          model: User,
          as: "followers",
          where: { id: profileUserId },
          through: { attributes: [] },
          attributes: [],
        },
      ],
      limit,
      offset,
      distinct: true,
      subQuery: false,
    });

    let followStatusMap = {};
    if (currentUser && following.length) {
      const followingIds = following.map((f) => f.id);
      const follows = await UserFollow.findAll({
        where: {
          followerId: currentUser.id,
          followingId: { [Op.in]: followingIds },
        },
        attributes: ["followingId"],
        raw: true,
      });
      const followingSet = new Set(follows.map((f) => f.followingId));
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

// Render edit profile form
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

// Update profile (name, bio, profile picture) - validation is now in the router
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, bio, removeImage } = req.body;
    const file = req.file;

    const user = await User.findByPk(userId);
    if (!user) {
      req.flash("error_msg", "User not found");
      return res.redirect("/profile/edit");
    }

    user.name = name.trim();
    user.bio = bio ? bio.trim() : null;

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

    if (file && oldPictureUrl) await deleteFromMinioByUrl(oldPictureUrl);

    req.flash("success_msg", "Profile updated successfully");
    res.redirect(`/profile/${userId}`);
  } catch (error) {
    next(error);
  }
};
