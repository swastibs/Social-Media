const { Post, Comment, PostLike, User, sequelize } = require("../../models");
const { getSafeUserInclude } = require("../../utils/dbHelper");
const { Op } = require("sequelize");
const { paginate } = require("../../utils/pagination");
const { uploadToMinio, deleteFromMinioByUrl } = require("../../config/minio");

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
        req.file.buffer,
        req.file.originalname,
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

    // ✅ Use default getSafeUserInclude (includes isVerified)
    const post = await Post.findOne({
      where: { id: postId, isDeleted: false },
      include: [getSafeUserInclude()],
    });

    if (!post) {
      req.flash("error_msg", "Post not found");
      return res.redirect("/feed");
    }

    // Check if current user liked this post
    let liked = false;
    if (req.user) {
      const like = await PostLike.findOne({
        where: { userId: req.user.id, postId: post.id },
      });
      liked = !!like;
    }

    // Get comments with pagination – ✅ use default getSafeUserInclude
    let { data: comments, pagination } = await paginate({
      model: Comment,
      where: { postId: post.id, isDeleted: false },
      include: [getSafeUserInclude()],
      order: [["createdAt", "DESC"]],
      page,
      limit,
    });

    // Calculate isEditable for each comment (within 15 minutes)
    const now = new Date();
    comments = comments.map((comment) => ({
      ...comment.toJSON(),
      isEditable: now - new Date(comment.createdAt) <= 15 * 60 * 1000,
    }));

    // Count total comments
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
      return res.redirect("/feed");
    }

    // Check authorization: only owner or admin
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
      return res.redirect("/feed");
    }

    if (post.userId !== req.user.id && req.user.role !== "admin") {
      await transaction.rollback();
      req.flash("error_msg", "Not authorized");
      return res.redirect(`/post/${postId}`);
    }

    // Update content
    post.content = content;

    // Handle new image upload (replaces old one)
    if (file) {
      // Delete old image (original + thumbnail)
      if (post.imageUrl) {
        await deleteFromMinioByUrl(post.imageUrl);
      }
      // Upload new image with thumbnail
      const { url, thumbnailUrl } = await uploadToMinio(
        file.buffer,
        file.originalname,
        "posts",
        { thumbnailSize: 400 },
      );
      post.imageUrl = url;
      post.thumbnailUrl = thumbnailUrl;
    }

    // Handle removal of existing image via checkbox
    if (removeImage === "true" && post.imageUrl) {
      await deleteFromMinioByUrl(post.imageUrl);
      post.imageUrl = null;
      post.thumbnailUrl = null;
    }

    await post.save({ transaction });
    await transaction.commit();

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
      return res.redirect("/feed");
    }

    if (post.userId !== req.user.id && req.user.role !== "admin") {
      await transaction.rollback();
      req.flash("error_msg", "Not authorized");
      return res.redirect(`/post/${postId}`);
    }

    // Soft delete post
    await post.update(
      { isDeleted: true, deletedBy: req.user.id },
      { transaction },
    );

    // Soft delete all comments of this post
    await Comment.update(
      { isDeleted: true, deletedBy: req.user.id },
      { where: { postId, isDeleted: false }, transaction },
    );

    // Decrement user's post count
    await req.user.decrement("postsCount", { transaction });

    await transaction.commit();

    req.flash("success_msg", "Post deleted successfully");
    res.redirect("/feed");
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

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
      await existing.destroy({ transaction });
      await post.decrement("likeCount", { transaction });
      await transaction.commit();
      return res.json({ liked: false, likeCount: post.likeCount - 1 });
    } else {
      await PostLike.create({ userId, postId }, { transaction });
      await post.increment("likeCount", { transaction });
      await transaction.commit();
      return res.json({ liked: true, likeCount: post.likeCount + 1 });
    }
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
