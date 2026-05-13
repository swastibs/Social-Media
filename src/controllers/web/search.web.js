const { User, Post, Comment, PostLike, sequelize } = require("../../models");
const { ROLES } = require("../../constant/role");
const { Op } = require("sequelize");
const { getSafeUserInclude } = require("../../utils/dbHelper");

// Helper: search users
async function searchUsers(searchTerm, limit, offset) {
    const where = {
        [Op.or]: [
            { name: { [Op.like]: `%${searchTerm}%` } },
            { email: { [Op.like]: `%${searchTerm}%` } },
            { bio: { [Op.like]: `%${searchTerm}%` } },
        ],
        isDeleted: false,
        isActive: true,
        role: ROLES.USER,
    };

    const { count, rows } = await User.findAndCountAll({
        where,
        attributes: ["id", "name", "email", "bio", "profilePictureUrl", "postsCount", "followersCount"],
        limit,
        offset,
        order: [["createdAt", "DESC"]],
    });

    return { data: rows, total: count, totalPages: Math.ceil(count / limit) };
}

// Helper: search posts
async function searchPosts(searchTerm, limit, offset, currentUserId) {
    const where = { content: { [Op.like]: `%${searchTerm}%` }, isDeleted: false };

    const { count, rows: posts } = await Post.findAndCountAll({
        where,
        include: [getSafeUserInclude()],
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        subQuery: false,
    });

    // check liked status for current user
    let likedPostIds = new Set();
    if (currentUserId && posts.length) {
        const postIds = posts.map(p => p.id);
        const likedPosts = await PostLike.findAll({
            where: { userId: currentUserId, postId: { [Op.in]: postIds } },
            attributes: ["postId"],
            raw: true,
        });
        likedPostIds = new Set(likedPosts.map(lp => lp.postId));
    }

    // get comment counts
    const postIds = posts.map(p => p.id);
    const commentCounts = await Comment.findAll({
        where: { postId: { [Op.in]: postIds }, isDeleted: false },
        attributes: ["postId", [sequelize.fn("COUNT", sequelize.col("id")), "commentCount"]],
        group: ["postId"],
        raw: true,
    });
    const commentCountMap = Object.fromEntries(commentCounts.map(cc => [cc.postId, parseInt(cc.commentCount)]));

    const postsWithDetails = posts.map(post => ({
        ...post.toJSON(),
        liked: likedPostIds.has(post.id),
        commentCount: commentCountMap[post.id] || 0,
    }));

    return { data: postsWithDetails, total: count, totalPages: Math.ceil(count / limit) };
}

// Helper: search comments
async function searchComments(searchTerm, limit, offset, currentUserId) {
    const where = { content: { [Op.like]: `%${searchTerm}%` }, isDeleted: false };

    const { count, rows: comments } = await Comment.findAndCountAll({
        where,
        include: [
            getSafeUserInclude(),
            {
                model: Post,
                attributes: ["id", "content", "imageUrl", "userId"],
                include: [getSafeUserInclude()],
            },
        ],
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        subQuery: false,
    });

    return { data: comments, total: count, totalPages: Math.ceil(count / limit) };
}

// Main search page (with pagination)
exports.searchPage = async (req, res, next) => {
    try {
        const { q, type = "all", page = 1 } = req.query;
        const limit = 12;                // matching feed pagination style
        const offset = (page - 1) * limit;
        const searchTerm = q?.trim();

        let results = {
            users: { data: [], total: 0, totalPages: 0 },
            posts: { data: [], total: 0, totalPages: 0 },
            comments: { data: [], total: 0, totalPages: 0 },
        };
        let activeTab = type;
        let currentPage = parseInt(page);

        if (searchTerm && searchTerm.length >= 2) {
            // run searches based on active tab (or all)
            if (type === "all" || type === "users") {
                results.users = await searchUsers(searchTerm, limit, offset);
            }
            if (type === "all" || type === "posts") {
                results.posts = await searchPosts(searchTerm, limit, offset, req.user?.id);
            }
            if (type === "all" || type === "comments") {
                results.comments = await searchComments(searchTerm, limit, offset, req.user?.id);
            }
        }

        res.render("search", {
            title: "Search",
            user: req.user,
            currentUser: req.user,
            searchQuery: searchTerm || "",
            activeTab,
            results,
            pagination: {
                currentPage,
                limit,
            },
        });
    } catch (error) {
        next(error);
    }
};