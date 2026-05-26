/**
 * Post Controller (Web)
 *
 * Handles:
 * - Creating / editing / deleting posts (with image upload to MinIO)
 * - Viewing a single post with its comments (paginated)
 * - Liking / unliking a post (AJAX)
 */

const {
  Post,
  Comment,
  PostLike,
  User,
  sequelize,
  UserFollow,
} = require("../../models");
const { getSafeUserInclude } = require("../../utils/dbHelper");
const { Op } = require("sequelize");
const { paginate } = require("../../utils/pagination");
const { uploadToMinio, deleteFromMinioByUrl } = require("../../config/minio");
const redirectBack = require("../../utils/redirectBack");
const { deleteByPattern } = require("../../utils/cache");

const shouldRemoveImage = (value) => value === true || value === "true";

// ========== CREATE POST ==========
exports.createPostForm = (req, res) => {
  res.render("create-post", {
    title: "Create Post",
    user: req.user,
    currentUser: req.user,
    pageCss: "create-edit-post.css",
  });
};

exports.createPost = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { content } = req.body;
    const file = req.file;
    let imageUrl = null;
    let thumbnailUrl = null;

    if (file) {
      const result = await uploadToMinio(
        file.buffer,
        file.originalname,
        "posts",
        { thumbnailSize: 400 },
      );
      imageUrl = result.url;
      thumbnailUrl = result.thumbnailUrl;
    }

    const post = await Post.create(
      {
        content,
        imageUrl,
        thumbnailUrl,
        userId: req.user.id,
        likeCount: 0,
        isDeleted: false,
      },
      { transaction },
    );

    await req.user.increment("postsCount", { transaction });
    await transaction.commit();

    // Invalidate feed and profile caches
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern(`web:cache:/profile/${req.user.id}*`);

    req.flash("success_msg", "Post created successfully");
    res.redirect(`/post/${post.id}`);
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// ========== SINGLE POST (with comments) ==========
exports.postDetail = async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;

    const post = await Post.findOne({
      where: { id: postId, isDeleted: false },
      include: [getSafeUserInclude()],
    });

    if (!post) {
      req.flash("error_msg", "Post not found");
      return redirectBack(req, res, "/feed");
    }

    // PRIVACY CHECK: If post author's account is private
    if (post.User && post.User.isPrivate) {
      // If not logged in, cannot view
      if (!req.user) {
        req.flash(
          "error_msg",
          "This post is from a private account. Please log in to view it.",
        );
        return redirectBack(req, res, "/feed");
      }
      // If logged in but not the author and not admin, check follow status
      if (req.user.id !== post.userId && req.user.role !== "admin") {
        const follow = await UserFollow.findOne({
          where: {
            followerId: req.user.id,
            followingId: post.userId,
            status: "accepted",
          },
        });
        if (!follow) {
          req.flash(
            "error_msg",
            "This post is from a private account. You need to follow the user to view their posts.",
          );
          return redirectBack(req, res, "/feed");
        }
      }
    }

    let liked = false;
    if (req.user) {
      const like = await PostLike.findOne({
        where: { userId: req.user.id, postId: post.id },
      });
      liked = !!like;
    }

    let { data: comments, pagination } = await paginate({
      model: Comment,
      where: { postId: post.id, isDeleted: false },
      include: [getSafeUserInclude()],
      order: [["createdAt", "DESC"]],
      page,
      limit,
    });

    const now = new Date();
    comments = comments.map((comment) => ({
      ...comment.toJSON(),
      isEditable: now - new Date(comment.createdAt) <= 15 * 60 * 1000,
    }));

    const totalComments = await Comment.count({
      where: { postId: post.id, isDeleted: false },
    });

    res.render("post-detail", {
      title: `Post by ${post.User.name}`,
      user: req.user,
      currentUser: req.user,
      post: {
        ...post.toJSON(),
        liked,
        commentCount: totalComments,
      },
      comments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalComments / limit),
        totalItems: totalComments,
        hasPrev: page > 1,
        hasNext: page < Math.ceil(totalComments / limit),
      },
      pageCss: "post-detail.css",
    });
  } catch (err) {
    next(err);
  }
};

// ========== EDIT POST ==========
exports.editPostForm = async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const post = await Post.findOne({
      where: { id: postId, isDeleted: false },
      include: [getSafeUserInclude()],
    });

    if (!post) {
      req.flash("error_msg", "Post not found");
      return redirectBack(req, res, "/feed");
    }

    if (post.userId !== req.user.id && req.user.role !== "admin") {
      req.flash("error_msg", "You are not authorized to edit this post");
      return res.redirect(`/post/${postId}`);
    }

    res.render("edit-post", {
      title: "Edit Post",
      user: req.user,
      currentUser: req.user,
      post,
      pageCss: "create-edit-post.css",
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const postId = req.params.postId;
    const { content, removeImage } = req.body;
    const file = req.file;

    const post = await Post.findOne({
      where: { id: postId, isDeleted: false },
      transaction,
    });

    if (!post) {
      await transaction.rollback();
      req.flash("error_msg", "Post not found");
      return redirectBack(req, res, "/feed");
    }

    if (post.userId !== req.user.id && req.user.role !== "admin") {
      await transaction.rollback();
      req.flash("error_msg", "Not authorized");
      return res.redirect(`/post/${postId}`);
    }

    // Capture old data for activity log
    const oldData = post.toJSON();
    post.content = content;

    if (file) {
      if (post.imageUrl) {
        await deleteFromMinioByUrl(post.imageUrl);
      }
      const result = await uploadToMinio(
        file.buffer,
        file.originalname,
        "posts",
        { thumbnailSize: 400 },
      );
      post.imageUrl = result.url;
      post.thumbnailUrl = result.thumbnailUrl;
    }

    if (shouldRemoveImage(removeImage) && post.imageUrl) {
      await deleteFromMinioByUrl(post.imageUrl);
      post.imageUrl = null;
      post.thumbnailUrl = null;
    }

    await post.save({ transaction });
    await transaction.commit();

    // Attach activity data
    req.activity = {
      entity: "Post",
      entityId: post.id,
      oldData,
      newData: post.toJSON(),
    };

    // Invalidate caches
    await deleteByPattern(`web:cache:/post/${postId}*`);
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern(`web:cache:/profile/${post.userId}*`);

    req.flash("success_msg", "Post updated successfully");
    res.redirect(`/post/${postId}`);
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// ========== DELETE POST ==========
exports.deletePost = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const postId = req.params.postId;
    const post = await Post.findOne({
      where: { id: postId, isDeleted: false },
      transaction,
    });

    if (!post) {
      await transaction.rollback();
      req.flash("error_msg", "Post not found");
      return redirectBack(req, res, "/feed");
    }

    if (post.userId !== req.user.id && req.user.role !== "admin") {
      await transaction.rollback();
      req.flash("error_msg", "Not authorized");
      return res.redirect(`/post/${postId}`);
    }

    await post.update(
      { isDeleted: true, deletedBy: req.user.id },
      { transaction },
    );

    await Comment.update(
      { isDeleted: true, deletedBy: req.user.id },
      { where: { postId, isDeleted: false }, transaction },
    );

    // Decrement postsCount of the author
    const author = await User.findByPk(post.userId, { transaction });
    if (author && author.postsCount > 0) {
      await author.decrement("postsCount", { transaction });
    }

    await transaction.commit();

    req.activity = {
      entity: "Post",
      entityId: post.id,
    };

    // Invalidate caches
    await deleteByPattern(`web:cache:/post/${postId}*`);
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern(`web:cache:/profile/${post.userId}*`);

    req.flash("success_msg", "Post deleted successfully");
    res.redirect("/feed");
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// ========== LIKE / UNLIKE (AJAX) ==========
exports.toggleLike = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const postId = req.params.postId;
    const userId = req.user.id;

    const post = await Post.findOne({
      where: { id: postId, isDeleted: false },
      transaction,
    });

    if (!post) {
      await transaction.rollback();
      return res.status(404).json({ error: "Post not found" });
    }

    const existing = await PostLike.findOne({
      where: { userId, postId },
      transaction,
    });

    if (existing) {
      // Unlike
      await existing.destroy({ transaction });
      await post.decrement("likeCount", { transaction });
      await transaction.commit();

      // Invalidate post cache
      await deleteByPattern(`web:cache:/post/${postId}*`);

      return res.json({ liked: false, likeCount: post.likeCount - 1 });
    } else {
      // Like
      await PostLike.create({ userId, postId }, { transaction });
      await post.increment("likeCount", { transaction });
      await transaction.commit();

      // Invalidate post cache
      await deleteByPattern(`web:cache:/post/${postId}*`);

      return res.json({ liked: true, likeCount: post.likeCount + 1 });
    }
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
