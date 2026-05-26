/**
 * User Controller (Web) – Follow management
 *
 * Handles:
 * - Follow / Unfollow user (with pending/accept flow for private accounts)
 * - Accept / Reject follow requests
 * - Show follow requests list
 * - Remove a follower (profile owner only)
 */

const { UserFollow, User, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { deleteByPattern } = require("../../utils/cache");

// ================================
// Follow / Unfollow (AJAX)
// ================================
exports.toggleFollow = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId);
    if (followerId === followingId) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    const targetUser = await User.findByPk(followingId, { transaction });
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    const existing = await UserFollow.findOne({
      where: { followerId, followingId },
      transaction,
    });

    // If already following (accepted) -> unfollow
    if (existing && existing.status === "accepted") {
      await existing.destroy({ transaction });

      // Safely decrement counts
      const follower = await User.findByPk(followerId, { transaction });
      const followed = await User.findByPk(followingId, { transaction });

      if (follower.followingCount > 0) {
        follower.followingCount -= 1;
        await follower.save({ transaction });
      }
      if (followed.followersCount > 0) {
        followed.followersCount -= 1;
        await followed.save({ transaction });
      }

      await transaction.commit();
      return res.json({ following: false, status: null });
    }

    // If a pending request exists -> cancel it
    if (existing && existing.status === "pending") {
      await existing.destroy({ transaction });
      await transaction.commit();
      return res.json({
        following: false,
        status: null,
        message: "Request cancelled",
      });
    }

    // New follow request
    const status = targetUser.isPrivate ? "pending" : "accepted";
    await UserFollow.create(
      { followerId, followingId, status },
      { transaction },
    );

    if (status === "accepted") {
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

    // Invalidate caches for both profiles
    await deleteByPattern(`web:cache:/profile/${followerId}*`);
    await deleteByPattern(`web:cache:/profile/${followingId}*`);

    return res.json({
      following: status === "accepted",
      status,
      message: status === "pending" ? "Follow request sent" : "Now following",
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// ================================
// Accept Follow Request
// ================================
exports.acceptFollowRequest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const currentUserId = req.user.id;
    const followerId = parseInt(req.params.userId);

    const follow = await UserFollow.findOne({
      where: { followerId, followingId: currentUserId, status: "pending" },
      transaction,
    });
    if (!follow) {
      req.flash("error_msg", "No pending request found");
      return res.redirect("back");
    }

    follow.status = "accepted";
    await follow.save({ transaction });

    await User.increment("followersCount", {
      by: 1,
      where: { id: currentUserId },
      transaction,
    });
    await User.increment("followingCount", {
      by: 1,
      where: { id: followerId },
      transaction,
    });

    await transaction.commit();

    // Invalidate caches
    await deleteByPattern(`web:cache:/profile/${currentUserId}*`);
    await deleteByPattern(`web:cache:/profile/${followerId}*`);

    req.flash("success_msg", "Follow request accepted");
    res.redirect("/follow-requests");
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// ================================
// Reject Follow Request
// ================================
exports.rejectFollowRequest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const currentUserId = req.user.id;
    const followerId = parseInt(req.params.userId);

    const follow = await UserFollow.findOne({
      where: { followerId, followingId: currentUserId, status: "pending" },
      transaction,
    });
    if (!follow) {
      req.flash("error_msg", "No pending request found");
      return res.redirect("back");
    }

    await follow.destroy({ transaction });
    await transaction.commit();

    req.flash("success_msg", "Follow request rejected");
    res.redirect("/follow-requests");
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// ================================
// Show Follow Requests Page
// ================================
exports.showFollowRequests = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const pendingRequests = await UserFollow.findAll({
      where: { followingId: userId, status: "pending" },
      include: [
        {
          model: User,
          as: "follower",
          attributes: ["id", "name", "profilePictureUrl", "bio"],
        },
      ],
    });
    res.render("follow-requests", {
      title: "Follow Requests",
      user: req.user,
      requests: pendingRequests,
      pageCss: "profile.css",
    });
  } catch (err) {
    next(err);
  }
};

// ================================
// Remove a Follower (Profile owner only)
// ================================
exports.removeFollower = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const loggedInUserId = req.user.id;
    const profileOwnerId = parseInt(req.params.userId, 10);
    const followerId = parseInt(req.params.followerId, 10);

    // Security: only the profile owner can remove their own followers
    if (loggedInUserId !== profileOwnerId) {
      if (req.xhr) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      req.flash("error_msg", "You are not authorized");
      return res.redirect("back");
    }

    if (profileOwnerId === followerId) {
      if (req.xhr) {
        return res
          .status(400)
          .json({ success: false, message: "You cannot remove yourself" });
      }
      req.flash("error_msg", "You cannot remove yourself");
      return res.redirect("back");
    }

    const follow = await UserFollow.findOne({
      where: { followerId, followingId: profileOwnerId, status: "accepted" },
      transaction,
    });

    if (!follow) {
      await transaction.rollback();
      if (req.xhr) {
        return res
          .status(404)
          .json({ success: false, message: "Follower not found" });
      }
      req.flash("error_msg", "Follower not found");
      return res.redirect("back");
    }

    await follow.destroy({ transaction });

    // Safely decrement counts
    const profileOwner = await User.findByPk(profileOwnerId, { transaction });
    const followerUser = await User.findByPk(followerId, { transaction });

    if (profileOwner.followersCount > 0) {
      profileOwner.followersCount -= 1;
      await profileOwner.save({ transaction });
    }
    if (followerUser.followingCount > 0) {
      followerUser.followingCount -= 1;
      await followerUser.save({ transaction });
    }

    await transaction.commit();

    // Invalidate caches
    await deleteByPattern(`web:cache:/profile/${profileOwnerId}*`);
    await deleteByPattern(`web:cache:/profile/${profileOwnerId}/followers*`);
    await deleteByPattern(`web:cache:/profile/${followerId}*`);

    if (req.xhr) {
      return res.json({
        success: true,
        message: "Follower removed successfully",
      });
    }

    req.flash("success_msg", "Follower removed successfully");
    res.redirect("back");
  } catch (err) {
    await transaction.rollback();
    if (req.xhr) {
      return res.status(500).json({ success: false, message: err.message });
    }
    next(err);
  }
};
