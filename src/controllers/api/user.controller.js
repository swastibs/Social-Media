const ApiError = require("../../utils/ApiError");
const { ROLES } = require("../../constant/role");
const { sanitizedUser } = require("../../utils/sanitizedUser");
const { successResponse } = require("../../utils/ApiResponse");
const { paginate } = require("../../utils/pagination");

const { User, Post, Comment, UserFollow, sequelize } = require("../../models");
const { getUser, getSafeUserInclude } = require("../../utils/dbHelper");
const {
  setCache,
  invalidateUserCache,
  invalidateFollowCache,
  invalidateFeedCache,
} = require("../../utils/cache");
const { Op } = require("sequelize");
const redis = require("../../config/redis");
const {
  getUserSessions,
  deleteToken,
  removeTokenFromUser,
} = require("../../utils/authCache");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl,
} = require("../../utils/cloudinaryUpload");

// GET ALL USERS
exports.getAllUsers = async (req, res, next) => {
  try {
    const {
      query: { page = 1, limit = 10, email, name },
    } = req;

    const where = {
      isDeleted: false,
      role: ROLES.USER,
      isActive: true,
    };

    if (email) where.email = email.toLowerCase();
    if (name) where.name = name;

    const { data, pagination } = await paginate({
      model: User,
      where,
      page,
      limit,
    });

    const result = data.map(sanitizedUser);

    if (req.cacheKey)
      await setCache(req.cacheKey, {
        data: result,
        meta: pagination,
        message: "Users fetched successfully",
      });

    return successResponse(res, {
      message: "Users fetched successfully",
      data: result,
      meta: pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET SINGLE USER
exports.getUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { user } = req;

    const targetUser = await getUser(userId);

    if (req.user.role === ROLES.USER && targetUser.role === ROLES.ADMIN)
      throw new ApiError(404, "User not found");

    const result = sanitizedUser(targetUser);

    if (req.cacheKey)
      await setCache(req.cacheKey, {
        data: result,
        message: "User fetched successfully",
      });

    return successResponse(res, {
      message: "User fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE USER
exports.deleteUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { userId } = req.params;
    const adminId = req.user.id;

    const targetUser = await User.findOne({
      where: { id: userId, isDeleted: false },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!targetUser) throw new ApiError(404, "User not found");
    if (targetUser.role === ROLES.ADMIN)
      throw new ApiError(403, "Cannot delete an admin");

    await targetUser.update(
      { isDeleted: true, isActive: false, deletedBy: adminId },
      { transaction },
    );

    const posts = await Post.findAll({
      where: { userId, isDeleted: false },
      attributes: ["id"],
      raw: true,
      transaction,
    });

    const postIds = posts.map((p) => p.id);

    await Post.update(
      { isDeleted: true, deletedBy: adminId },
      { where: { userId, isDeleted: false }, transaction },
    );

    await Comment.update(
      { isDeleted: true, deletedBy: adminId },
      {
        where: {
          isDeleted: false,
          [Op.or]: [
            { userId },
            ...(postIds.length ? [{ postId: postIds }] : []),
          ],
        },
        transaction,
      },
    );

    await transaction.commit();

    // Invalidate caches
    await invalidateUserCache(userId);

    req.activity = {
      entity: "User",
      entityId: targetUser.id,
    };

    return successResponse(res, {
      message: "User deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// UPDATE USER ACTION (Admin)
exports.updateUserAction = async (req, res, next) => {
  try {
    const { userId, action } = req.params;

    const targetUser = await getUser(userId);

    if (targetUser.role === ROLES.ADMIN)
      throw new ApiError(403, "You are not allowed to modify an admin user");

    const oldData = sanitizedUser(targetUser);
    let message = "";

    switch (action) {
      case "active":
        targetUser.isActive = true;
        message = "User activated successfully";
        break;
      case "inactive":
        targetUser.isActive = false;
        message = "User deactivated successfully";
        break;
      case "promote":
        targetUser.role = "admin";
        message = "User promoted successfully";
        break;
      default:
        throw new ApiError(400, "Invalid action");
    }

    await targetUser.save();

    const newData = sanitizedUser(targetUser);

    // Invalidate caches
    await invalidateUserCache(userId);

    req.activity = {
      entity: "User",
      entityId: targetUser.id,
      oldData,
      newData,
    };

    return successResponse(res, { message });
  } catch (error) {
    next(error);
  }
};

// GET ALL POSTS OF USER
exports.getAllPostsOfUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const targetUser = await getUser(userId);
    if (!targetUser.isActive) throw new ApiError(403, "User inactive");

    const { data, pagination } = await paginate({
      model: Post,
      where: { userId, isDeleted: false },
      page,
      limit,
      include: [getSafeUserInclude()],
    });

    if (req.cacheKey)
      await setCache(req.cacheKey, {
        data,
        meta: pagination,
        message: "Posts fetched successfully",
      });

    return successResponse(res, {
      message: "Posts fetched successfully",
      data,
      meta: pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET SINGLE POST OF USER
exports.getPostOfUser = async (req, res, next) => {
  try {
    const { userId, postId } = req.params;

    const targetUser = await getUser(userId);
    if (!targetUser.isActive) throw new ApiError(403, "User inactive");

    const post = await Post.findOne({
      where: { id: postId, userId, isDeleted: false },
      include: [getSafeUserInclude()],
    });

    if (!post) throw new ApiError(404, "Post not found");

    if (req.cacheKey)
      await setCache(req.cacheKey, {
        data: post,
        message: "Post fetched successfully",
      });

    return successResponse(res, {
      message: "Post fetched successfully",
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL COMMENTS OF USER
exports.getAllCommentsOfUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const targetUser = await getUser(userId);
    if (!targetUser.isActive) throw new ApiError(403, "User inactive");

    const { data, pagination } = await paginate({
      model: Comment,
      where: { userId, isDeleted: false },
      page,
      limit,
      include: [
        getSafeUserInclude(),
        { model: Post, attributes: ["id", "content"] },
      ],
    });

    if (req.cacheKey)
      await setCache(req.cacheKey, {
        data,
        meta: pagination,
        message: "Comments fetched successfully",
      });

    return successResponse(res, {
      message: "Comments fetched successfully",
      data,
      meta: pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET SINGLE COMMENT OF USER
exports.getCommentOfUser = async (req, res, next) => {
  try {
    const { userId, commentId } = req.params;

    const targetUser = await getUser(userId);
    if (!targetUser.isActive) throw new ApiError(403, "User inactive");

    const comment = await Comment.findOne({
      where: { id: commentId, userId, isDeleted: false },
      include: [
        getSafeUserInclude(),
        { model: Post, attributes: ["id", "content"] },
      ],
    });

    if (!comment) throw new ApiError(404, "Comment not found");

    if (req.cacheKey)
      await setCache(req.cacheKey, {
        data: comment,
        message: "Comment fetched successfully",
      });

    return successResponse(res, {
      message: "Comment fetched successfully",
      data: comment,
    });
  } catch (error) {
    next(error);
  }
};

// Follow/Unfollow USER (corrected)
exports.followUnfollowUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const followerId = req.user.id;
    const { userId: followingId } = req.params;

    if (Number(followerId) === Number(followingId)) {
      await transaction.rollback();
      throw new ApiError(400, "You cannot follow yourself");
    }

    const targetUser = await User.findOne({
      where: { id: followingId, isDeleted: false },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!targetUser) {
      await transaction.rollback();
      throw new ApiError(404, "User not found");
    }

    if (!targetUser.isActive) {
      await transaction.rollback();
      throw new ApiError(403, "User inactive");
    }

    // Find or create the follow record (default status = 'pending')
    const [relation, created] = await UserFollow.findOrCreate({
      where: { followerId, followingId },
      defaults: { followerId, followingId, status: "pending" },
      transaction,
    });

    if (!created) {
      // UNFOLLOW: delete the record and decrement counts
      await relation.destroy({ transaction });
      await User.decrement("followingCount", {
        by: 1,
        where: { id: followerId },
        transaction,
      });
      await User.decrement("followersCount", {
        by: 1,
        where: { id: followingId },
        transaction,
      });
      await transaction.commit();
      return successResponse(res, {
        message: "User unfollowed successfully",
        data: { following: false },
      });
    } else {
      // NEW FOLLOW: determine final status based on privacy
      let finalStatus = targetUser.isPrivate ? "pending" : "accepted";
      if (finalStatus === "accepted") {
        relation.status = "accepted";
        await relation.save({ transaction });
        await User.increment("followingCount", {
          by: 1,
          where: { id: followerId },
          transaction,
        });
        await User.increment("followersCount", {
          by: 1,
          where: { id: followingId },
          transaction,
        });
      }
      await transaction.commit();
      return successResponse(res, {
        message:
          finalStatus === "accepted"
            ? "User followed successfully"
            : "Follow request sent",
        data: { following: finalStatus === "accepted", status: finalStatus },
      });
    }
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// GET FOLLOWERS OF USER
exports.getFollowers = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    await getUser(userId);

    const { data, pagination } = await paginate({
      model: User,
      page,
      limit,
      include: [
        {
          model: User,
          as: "following",
          where: { id: userId },
          through: {
            attributes: [],
          },
          attributes: [],
        },
      ],
    });

    const result = data.map(sanitizedUser);

    if (req.cacheKey)
      await setCache(req.cacheKey, {
        data: result,
        meta: pagination,
        message: "Followers fetched successfully",
      });

    return successResponse(res, {
      message: "Followers fetched successfully",
      data: result,
      meta: pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET FOLLOWING OF USER
exports.getFollowing = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    await getUser(userId);

    const { data, pagination } = await paginate({
      model: User,
      page,
      limit,
      include: [
        {
          model: User,
          as: "followers",
          where: { id: userId },
          through: { attributes: [] },
          attributes: [],
        },
      ],
    });

    const result = data.map(sanitizedUser);

    if (req.cacheKey)
      await setCache(req.cacheKey, {
        data: result,
        meta: pagination,
        message: "Following fetched successfully",
      });

    return successResponse(res, {
      message: "Following fetched successfully",
      data: result,
      meta: pagination,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE PROFILE
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, bio } = req.body;
    const file = req.file;

    const user = await User.findByPk(userId);
    if (!user) throw new ApiError(404, "User not found");

    if (name !== undefined && name.trim()) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();

    const oldPictureUrl = user.profilePictureUrl;

    if (file) {
      // Delete old profile picture if exists
      if (oldPictureUrl) {
        const oldPublicId = getPublicIdFromUrl(oldPictureUrl);
        if (oldPublicId) await deleteFromCloudinary(oldPublicId);
      }
      const { url, thumbnailUrl } = await uploadToCloudinary(
        file.buffer,
        "profiles",
        { thumbnailSize: 80 },
      );
      user.profilePictureUrl = url;
      user.thumbnailUrl = thumbnailUrl;
    }

    await user.save();

    // Invalidate caches
    await invalidateUserCache(userId);
    await invalidateFeedCache();

    return successResponse(res, {
      message: "Profile updated successfully",
      data: {
        id: user.id,
        name: user.name,
        bio: user.bio,
        profilePictureUrl: user.profilePictureUrl,
        thumbnailUrl: user.thumbnailUrl,
        postsCount: user.postsCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// SESSION MANAGEMENT
exports.getSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sessions = await getUserSessions(userId);
    return successResponse(res, {
      message: "Active sessions retrieved",
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
};

exports.revokeSessionByToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) throw new ApiError(400, "Token is required");

    const userId = req.user.id;

    const userTokens = await redis.smembers(`user:tokens:${userId}`);
    if (!userTokens.includes(token)) {
      throw new ApiError(403, "Token does not belong to you");
    }

    await deleteToken(token);
    await removeTokenFromUser(userId, token);

    return successResponse(res, { message: "Session revoked successfully" });
  } catch (error) {
    next(error);
  }
};

exports.revokeOtherSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentToken =
      req.headers.authorization?.split(" ")[1] || req.cookies?.postloop_token;

    if (!currentToken) {
      throw new ApiError(400, "Current token not found");
    }

    const userTokens = await redis.smembers(`user:tokens:${userId}`);

    for (const token of userTokens) {
      if (token !== currentToken) {
        await deleteToken(token);
        await removeTokenFromUser(userId, token);
      }
    }

    return successResponse(res, { message: "Other sessions revoked" });
  } catch (error) {
    next(error);
  }
};
