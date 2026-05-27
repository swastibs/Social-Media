/**
 * Admin Controller (Web)
 * Full-featured admin panel with user/post/comment/activity management.
 */

const { Op } = require("sequelize");
const { User, Post, Comment, sequelize } = require("../../models");
const Activity = require("../../models/activity.model");
const { paginate } = require("../../utils/pagination");
const ApiError = require("../../utils/ApiError");
const { ROLES } = require("../../constant/role");
const { deleteByPattern } = require("../../utils/cache");

// ========== Helper Functions ==========
const adminUserInclude = {
  model: User,
  attributes: ["id", "name", "thumbnailUrl", "profilePictureUrl", "isVerified"],
  required: false,
};

const redirectBack = (req, res, fallback = "/admin/dashboard") => {
  const referer = req.get("Referrer") || req.get("Referer");
  return res.redirect(referer || fallback);
};

const handleAdminActionError = async (err, transaction, req, res, fallback) => {
  if (transaction && !transaction.finished) await transaction.rollback();

  req.flash("error", err.message || "Admin action failed");
  req.flash("error_msg", err.message || "Admin action failed");
  return redirectBack(req, res, fallback);
};

const blockDeletedEntity = (entity) => {
  if (entity?.isDeleted) throw new ApiError(400, "Cannot modify deleted item");
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getDateRange = (from, to) => {
  const range = {};
  if (from) range[Op.gte] = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range[Op.lte] = end;
  }
  return Object.keys(range).length ? range : null;
};

const getSortDirection = (order) =>
  String(order || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

const applyDeletedFilter = (where, deleted) => {
  if (deleted === "deleted") where.isDeleted = true;
  if (deleted === "active") where.isDeleted = false;
};

const postCommentCountAttribute = [
  sequelize.fn("COUNT", sequelize.col("Comments.id")),
  "commentCount",
];

const getPostGroupColumns = () => [
  "Post.id",
  "User.id",
  "User.name",
  "User.thumbnailUrl",
  "User.profilePictureUrl",
  "User.isVerified",
];

const addCommentCountQueryOptions = (options = {}) => ({
  ...options,
  attributes: {
    ...(options.attributes || {}),
    include: [
      ...(options.attributes?.include || []),
      postCommentCountAttribute,
    ],
  },
  include: [
    ...(options.include || []),
    { model: Comment, attributes: [], required: false },
  ],
  group: [...(options.group || []), ...getPostGroupColumns()],
  subQuery: false,
});

const toPostWithNumericCommentCount = (post) => {
  const json = typeof post.toJSON === "function" ? post.toJSON() : post;
  return {
    ...json,
    commentCount: Number(json.commentCount || 0),
  };
};

const findPostsWithCommentCounts = async ({
  where = {},
  limit,
  offset,
  order = [["createdAt", "DESC"]],
}) => {
  const posts = await Post.findAll(
    addCommentCountQueryOptions({
      where,
      include: [adminUserInclude],
      limit,
      offset,
      order,
    }),
  );
  return posts.map(toPostWithNumericCommentCount);
};

const countCommentsForPosts = async (posts) => {
  if (!posts.length) return posts;
  const postIds = posts.map((post) => post.id);
  const commentCounts = await Comment.findAll({
    where: { postId: { [Op.in]: postIds } },
    attributes: [
      "postId",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    group: ["postId"],
    raw: true,
  });
  const countMap = Object.fromEntries(
    commentCounts.map((comment) => [
      comment.postId,
      parseInt(comment.count, 10),
    ]),
  );
  return posts.map((post) => ({
    ...(typeof post.toJSON === "function" ? post.toJSON() : post),
    commentCount: countMap[post.id] || 0,
  }));
};

// ========== Dashboard ==========
exports.dashboard = async (req, res, next) => {
  try {
    const totalUsers = await User.count();
    const totalPosts = await Post.count();
    const totalComments = await Comment.count();

    const latestUsers = await User.findAll({
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
      limit: 5,
    });
    const latestPosts = await Post.findAll({
      include: [adminUserInclude],
      order: [["createdAt", "DESC"]],
      limit: 5,
    });
    const latestComments = await Comment.findAll({
      include: [
        adminUserInclude,
        { model: Post, attributes: ["id", "content"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: 5,
    });
    const recentActivities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(10);

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      user: req.user,
      stats: { totalUsers, totalPosts, totalComments },
      latestUsers,
      latestPosts,
      latestComments,
      recentActivities,
      pageCss: "admin.css",
    });
  } catch (err) {
    next(err);
  }
};

// ========== Users List ==========
exports.users = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      role = "",
      status = "",
      deleted = "all",
      createdFrom = "",
      createdTo = "",
      sortBy = "createdAt",
      order = "DESC",
    } = req.query;
    const where = { id: { [Op.ne]: req.user.id } };
    if (search)
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];

    if (["user", "admin"].includes(role)) where.role = role;
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;
    applyDeletedFilter(where, deleted);

    const createdAt = getDateRange(createdFrom, createdTo);
    if (createdAt) where.createdAt = createdAt;

    const allowedSort = ["createdAt", "postsCount", "followersCount", "name"];
    const sortField = allowedSort.includes(sortBy) ? sortBy : "createdAt";
    const sortOrder = getSortDirection(order);

    const { data, pagination } = await paginate({
      model: User,
      where,
      page,
      limit,
      order: [[sortField, sortOrder]],
    });
    res.render("admin/users", {
      title: "Manage Users",
      user: req.user,
      users: data,
      pagination,
      searchQuery: search,
      filters: {
        role,
        status,
        deleted,
        createdFrom,
        createdTo,
        sortBy: sortField,
        order: sortOrder,
      },
      pageCss: "admin.css",
    });
  } catch (err) {
    next(err);
  }
};

// ========== Posts List ==========
exports.posts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      createdFrom = "",
      createdTo = "",
      minLikes = "",
      maxLikes = "",
      hasImage = "any",
      deleted = "all",
      sortBy = "createdAt",
      order = "DESC",
    } = req.query;
    const where = {};
    if (search) where.content = { [Op.like]: `%${search}%` };

    applyDeletedFilter(where, deleted);

    const createdAt = getDateRange(createdFrom, createdTo);
    if (createdAt) where.createdAt = createdAt;

    const likeCount = {};
    const minLikesNumber = Number(minLikes);
    const maxLikesNumber = Number(maxLikes);
    if (minLikes !== "" && Number.isFinite(minLikesNumber))
      likeCount[Op.gte] = minLikesNumber;

    if (maxLikes !== "" && Number.isFinite(maxLikesNumber))
      likeCount[Op.lte] = maxLikesNumber;

    if (Object.keys(likeCount).length) where.likeCount = likeCount;

    if (hasImage === "yes") where.imageUrl = { [Op.ne]: null };
    if (hasImage === "no") where.imageUrl = null;

    const sortOrder = getSortDirection(order);
    const allowedSort = ["createdAt", "likeCount", "commentCount"];
    const sortField = allowedSort.includes(sortBy) ? sortBy : "createdAt";
    const sortClause =
      sortField === "commentCount"
        ? [[sequelize.literal("commentCount"), sortOrder]]
        : [[sortField, sortOrder]];

    const safeLimit = Math.min(parseInt(limit, 10) || 20, 50);
    const totalRecords = await Post.count({ where });
    const totalPages = Math.max(Math.ceil(totalRecords / safeLimit), 1);
    const safePage = Math.min(Math.max(parseInt(page, 10) || 1, 1), totalPages);
    const postsWithCounts = await findPostsWithCommentCounts({
      where,
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
      order: sortClause,
    });
    const pagination = {
      totalRecords,
      totalPages,
      currentPage: safePage,
      limit: safeLimit,
    };

    res.render("admin/posts", {
      title: "Manage Posts",
      user: req.user,
      posts: postsWithCounts,
      pagination,
      searchQuery: search,
      filters: {
        createdFrom,
        createdTo,
        minLikes,
        maxLikes,
        hasImage,
        deleted,
        sortBy: sortField,
        order: sortOrder,
      },
      pageCss: "admin.css",
    });
  } catch (err) {
    next(err);
  }
};

// ========== Comments List ==========
exports.comments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      createdFrom = "",
      createdTo = "",
      deleted = "all",
      sortBy = "createdAt",
      order = "DESC",
    } = req.query;
    const where = {};
    if (search) where.content = { [Op.like]: `%${search}%` };

    applyDeletedFilter(where, deleted);

    const createdAt = getDateRange(createdFrom, createdTo);
    if (createdAt) where.createdAt = createdAt;

    const allowedSort = ["createdAt", "postId"];
    const sortField = allowedSort.includes(sortBy) ? sortBy : "createdAt";
    const sortOrder = getSortDirection(order);

    const { data, pagination } = await paginate({
      model: Comment,
      where,
      page,
      limit,
      include: [
        adminUserInclude,
        { model: Post, attributes: ["id", "content"] },
      ],
      order: [[sortField, sortOrder]],
    });
    res.render("admin/comments", {
      title: "Manage Comments",
      user: req.user,
      comments: data,
      pagination,
      searchQuery: search,
      filters: {
        createdFrom,
        createdTo,
        deleted,
        sortBy: sortField,
        order: sortOrder,
      },
      pageCss: "admin.css",
    });
  } catch (err) {
    next(err);
  }
};

// ========== Activities List ==========
exports.activities = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      userId,
      method,
      route,
      status,
      entity,
      startDate,
      endDate,
    } = req.query;
    const query = {};
    if (userId && Number.isInteger(Number(userId)))
      query.userId = Number(userId);

    if (method) query.method = method;
    if (route) query.route = { $regex: escapeRegex(route), $options: "i" };
    if (status && Number.isInteger(Number(status)))
      query.responseStatus = Number(status);

    if (entity) query.entity = entity;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const totalRecords = await Activity.countDocuments(query);
    const totalPages = Math.max(Math.ceil(totalRecords / limitNum), 1);
    const safePage = Math.min(pageNum, totalPages);
    const safeSkip = (safePage - 1) * limitNum;
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(safeSkip)
      .limit(limitNum);

    const [uniqueMethods, uniqueStatuses, uniqueEntities] = await Promise.all([
      Activity.distinct("method"),
      Activity.distinct("responseStatus"),
      Activity.distinct("entity"),
    ]);

    res.render("admin/activities", {
      title: "Activity Logs",
      user: req.user,
      activities,
      filters: {
        userId: userId || "",
        method: method || "",
        route: route || "",
        status: status || "",
        entity: entity || "",
        startDate: startDate || "",
        endDate: endDate || "",
      },
      uniqueMethods,
      uniqueStatuses: uniqueStatuses.sort((a, b) => a - b),
      uniqueEntities: uniqueEntities.filter((e) => e),
      pagination: {
        currentPage: safePage,
        totalPages,
        totalRecords,
        limit: limitNum,
      },
      pageCss: "admin.css",
    });
  } catch (err) {
    next(err);
  }
};

// ========== Global Search ==========
exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    const requestedType = req.query.type || "all";
    const type = ["all", "users", "posts", "comments"].includes(requestedType)
      ? requestedType
      : "all";
    const limit = 20;
    const searchTerm = q?.trim();

    let results = { users: [], posts: [], comments: [] };
    let totalUsers = 0,
      totalPosts = 0,
      totalComments = 0;

    if (searchTerm && searchTerm.length >= 2) {
      const userWhere = {
        [Op.or]: [
          { name: { [Op.like]: `%${searchTerm}%` } },
          { email: { [Op.like]: `%${searchTerm}%` } },
        ],
      };
      const postWhere = {
        content: { [Op.like]: `%${searchTerm}%` },
      };
      const commentWhere = {
        content: { [Op.like]: `%${searchTerm}%` },
      };

      [totalUsers, totalPosts, totalComments] = await Promise.all([
        User.count({ where: userWhere }),
        Post.count({ where: postWhere }),
        Comment.count({ where: commentWhere }),
      ]);

      if (type === "all" || type === "users")
        results.users = await User.findAll({
          where: userWhere,
          attributes: { exclude: ["password"] },
          limit,
          order: [["createdAt", "DESC"]],
        });

      if (type === "all" || type === "posts")
        results.posts = await findPostsWithCommentCounts({
          where: postWhere,
          limit,
          order: [["createdAt", "DESC"]],
        });

      if (type === "all" || type === "comments")
        results.comments = await Comment.findAll({
          where: commentWhere,
          include: [
            adminUserInclude,
            { model: Post, attributes: ["id", "content"] },
          ],
          limit,
          order: [["createdAt", "DESC"]],
        });
    }

    res.render("admin/search", {
      title: "Admin Search",
      user: req.user,
      searchQuery: searchTerm,
      activeTab: type,
      results,
      counts: { users: totalUsers, posts: totalPosts, comments: totalComments },
      pageCss: "admin.css",
    });
  } catch (err) {
    next(err);
  }
};

// ========== User Profile (Admin View) ==========
exports.userProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await User.findByPk(userId, {
      attributes: { exclude: ["password"] },
    });
    if (!user) {
      req.flash("error_msg", "User not found");
      return res.redirect("/admin/users");
    }
    const isSelf = Number(userId) === req.user.id;
    const posts = isSelf
      ? []
      : await Post.findAll({
          where: { userId },
          include: [adminUserInclude],
          order: [["createdAt", "DESC"]],
          limit: 10,
        });
    const postsWithCounts = await countCommentsForPosts(posts);

    res.render("admin/user-profile", {
      title: `User: ${user.name}`,
      user: req.user,
      profileUser: user,
      posts: postsWithCounts,
      pageCss: "admin.css",
    });
  } catch (err) {
    next(err);
  }
};

// ========== Post Detail (Admin View) ==========
exports.postDetail = async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const post = await Post.findOne({
      where: { id: postId },
      include: [adminUserInclude],
    });
    if (!post) {
      req.flash("error_msg", "Post not found");
      return res.redirect("/admin/posts");
    }
    const comments = await Comment.findAll({
      where: { postId },
      include: [adminUserInclude],
      order: [["createdAt", "DESC"]],
    });
    res.render("admin/post-detail", {
      title: `Post by ${post.User.name}`,
      user: req.user,
      post,
      comments,
      pageCss: "admin.css",
    });
  } catch (err) {
    next(err);
  }
};

// ========== Admin Actions ==========
exports.activateUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const user = await User.findOne({
      where: { id: req.params.userId },
      transaction,
    });
    if (!user) throw new ApiError(404, "User not found");
    blockDeletedEntity(user);
    if (user.role === ROLES.ADMIN && user.id !== req.user.id)
      throw new ApiError(
        403,
        "Admin accounts cannot be changed from this action",
      );

    user.isActive = true;
    await user.save({ transaction });
    await transaction.commit();
    await deleteByPattern(`web:cache:/profile/${user.id}*`);
    await deleteByPattern("web:cache:/admin/users*");
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern("web:cache:/search*");
    req.flash("success_msg", "User activated");
    return redirectBack(req, res, "/admin/users");
  } catch (err) {
    return handleAdminActionError(err, transaction, req, res, "/admin/users");
  }
};

exports.deactivateUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const user = await User.findOne({
      where: { id: req.params.userId },
      transaction,
    });
    if (!user) throw new ApiError(404, "User not found");
    blockDeletedEntity(user);
    if (user.id === req.user.id)
      throw new ApiError(403, "You cannot deactivate your own admin account");
    if (user.role === ROLES.ADMIN)
      throw new ApiError(403, "Admin accounts cannot be deactivated here");

    user.isActive = false;
    await user.save({ transaction });
    await transaction.commit();
    await deleteByPattern(`web:cache:/profile/${user.id}*`);
    await deleteByPattern("web:cache:/admin/users*");
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern("web:cache:/search*");
    req.flash("success_msg", "User deactivated");
    return redirectBack(req, res, "/admin/users");
  } catch (err) {
    return handleAdminActionError(err, transaction, req, res, "/admin/users");
  }
};

exports.promoteToAdmin = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const user = await User.findOne({
      where: { id: req.params.userId },
      transaction,
    });
    if (!user) throw new ApiError(404, "User not found");
    blockDeletedEntity(user);
    if (user.role === ROLES.ADMIN)
      throw new ApiError(400, "User is already admin");

    user.role = ROLES.ADMIN;
    user.isActive = true;
    await user.save({ transaction });
    await transaction.commit();
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern("web:cache:/search*");
    await deleteByPattern(`web:cache:/profile/${user.id}*`);
    await deleteByPattern("web:cache:/admin/users*");
    req.flash("success_msg", "User promoted to admin");
    return redirectBack(req, res, "/admin/users");
  } catch (err) {
    return handleAdminActionError(err, transaction, req, res, "/admin/users");
  }
};

exports.deleteUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const user = await User.findOne({
      where: { id: req.params.userId },
      transaction,
    });
    if (!user) throw new ApiError(404, "User not found");
    blockDeletedEntity(user);
    if (user.id === req.user.id)
      throw new ApiError(403, "You cannot delete your own admin account");

    if (user.role === ROLES.ADMIN)
      throw new ApiError(403, "Cannot delete admin accounts");

    await user.update(
      { isDeleted: true, isActive: false, deletedBy: req.user.id },
      { transaction },
    );
    await Post.update(
      { isDeleted: true, deletedBy: req.user.id },
      { where: { userId: user.id }, transaction },
    );
    await Comment.update(
      { isDeleted: true, deletedBy: req.user.id },
      { where: { userId: user.id }, transaction },
    );
    await transaction.commit();
    await deleteByPattern(`web:cache:/profile/${user.id}*`);
    await deleteByPattern("web:cache:/admin/users*");
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern("web:cache:/search*");
    req.flash("success_msg", "User deleted");
    return res.redirect("/admin/users");
  } catch (err) {
    return handleAdminActionError(err, transaction, req, res, "/admin/users");
  }
};

exports.deletePost = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const post = await Post.findOne({
      where: { id: req.params.postId },
      transaction,
    });
    if (!post) throw new ApiError(404, "Post not found");
    blockDeletedEntity(post);
    await post.update(
      { isDeleted: true, deletedBy: req.user.id },
      { transaction },
    );
    await Comment.update(
      { isDeleted: true, deletedBy: req.user.id },
      { where: { postId: post.id }, transaction },
    );
    await User.decrement("postsCount", {
      by: 1,
      where: { id: post.userId },
      transaction,
    });
    await transaction.commit();
    await deleteByPattern(`web:cache:/post/${post.id}*`);
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern(`web:cache:/profile/${post.userId}*`);
    await deleteByPattern("web:cache:/admin/posts*");
    await deleteByPattern("web:cache:/search*");
    req.flash("success_msg", "Post deleted");
    return res.redirect("/admin/posts");
  } catch (err) {
    return handleAdminActionError(err, transaction, req, res, "/admin/posts");
  }
};

exports.deleteComment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const comment = await Comment.findOne({
      where: { id: req.params.commentId },
      transaction,
    });
    if (!comment) throw new ApiError(404, "Comment not found");
    blockDeletedEntity(comment);
    await comment.update(
      { isDeleted: true, deletedBy: req.user.id },
      { transaction },
    );
    await transaction.commit();
    await deleteByPattern(`web:cache:/post/${comment.postId}*`);
    await deleteByPattern("web:cache:/admin/comments*");
    await deleteByPattern("web:cache:/search*");
    req.flash("success_msg", "Comment deleted");
    return redirectBack(req, res, "/admin/comments");
  } catch (err) {
    return handleAdminActionError(
      err,
      transaction,
      req,
      res,
      "/admin/comments",
    );
  }
};
