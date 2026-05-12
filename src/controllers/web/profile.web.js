const cloudinary = require("cloudinary").v2;
const { User, Post, PostLike, Comment, UserFollow, sequelize } = require("../../models");
const { ROLES } = require("../../constant/role");
const { Op } = require("sequelize");
const { getSafeUserInclude } = require("../../utils/dbHelper");
const { uploadToCloudinary } = require("../../utils/cloudinaryUpload");

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
            attributes: ["id", "name", "email", "bio", "profilePictureUrl", "postsCount", "followersCount", "followingCount", "isActive", "role"],
        });
        if (!profileUser || profileUser.isDeleted) {
            req.flash("error_msg", "User not found");
            return res.redirect("/feed");
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

        const postIds = posts.map(p => p.id);
        let likedSet = new Set();
        let commentCountMap = {};

        if (currentUser && postIds.length) {
            const likedPosts = await PostLike.findAll({
                where: { userId: currentUser.id, postId: { [Op.in]: postIds } },
                attributes: ["postId"],
                raw: true,
            });
            likedSet = new Set(likedPosts.map(lp => lp.postId));

            const commentCounts = await Comment.findAll({
                where: { postId: { [Op.in]: postIds }, isDeleted: false },
                attributes: ["postId", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
                group: ["postId"],
                raw: true,
            });
            commentCountMap = Object.fromEntries(commentCounts.map(cc => [cc.postId, parseInt(cc.count)]));
        }

        const postsWithMeta = posts.map(post => ({
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
            return res.redirect("/feed");
        }

        const { count, rows: followers } = await User.findAndCountAll({
            where: { isDeleted: false, isActive: true, role: ROLES.USER },
            include: [{
                model: User,
                as: "following",
                where: { id: profileUserId },
                through: { attributes: [] },
                attributes: [],
            }],
            limit,
            offset,
            distinct: true,
            subQuery: false,
        });

        let followStatusMap = {};
        if (currentUser && followers.length) {
            const followerIds = followers.map(f => f.id);
            const follows = await UserFollow.findAll({
                where: { followerId: currentUser.id, followingId: { [Op.in]: followerIds } },
                attributes: ["followingId"],
                raw: true,
            });
            const followingSet = new Set(follows.map(f => f.followingId));
            followStatusMap = Object.fromEntries(followerIds.map(id => [id, followingSet.has(id)]));
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
            return res.redirect("/feed");
        }

        const { count, rows: following } = await User.findAndCountAll({
            where: { isDeleted: false, isActive: true, role: ROLES.USER },
            include: [{
                model: User,
                as: "followers",
                where: { id: profileUserId },
                through: { attributes: [] },
                attributes: [],
            }],
            limit,
            offset,
            distinct: true,
            subQuery: false,
        });

        let followStatusMap = {};
        if (currentUser && following.length) {
            const followingIds = following.map(f => f.id);
            const follows = await UserFollow.findAll({
                where: { followerId: currentUser.id, followingId: { [Op.in]: followingIds } },
                attributes: ["followingId"],
                raw: true,
            });
            const followingSet = new Set(follows.map(f => f.followingId));
            followStatusMap = Object.fromEntries(followingIds.map(id => [id, followingSet.has(id)]));
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

        // Update name and bio
        user.name = name.trim();
        user.bio = bio ? bio.trim() : null;

        // Handle profile picture
        let newUpload = null;
        const oldPublicId = user.profilePicturePublicId;

        if (file) {
            newUpload = await uploadToCloudinary(file, "postloop/profiles");
            user.profilePictureUrl = newUpload.secure_url;
            user.profilePicturePublicId = newUpload.public_id;
        }

        if (removeImage === "true" && user.profilePicturePublicId) {
            await cloudinary.uploader.destroy(user.profilePicturePublicId);
            user.profilePictureUrl = null;
            user.profilePicturePublicId = null;
        }

        await user.save();

        // Delete old image if replaced
        if (file && oldPublicId) {
            await cloudinary.uploader.destroy(oldPublicId);
        }

        req.flash("success_msg", "Profile updated successfully");
        res.redirect(`/profile/${userId}`);
    } catch (error) {
        if (req.file && error && error.public_id) {
            try {
                await cloudinary.uploader.destroy(error.public_id);
            } catch (_) { }
        }
        next(error);
    }
};