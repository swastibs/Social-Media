const ApiError = require("../utils/ApiError");
const { successResponse } = require("../utils/ApiResponse");
const { paginate } = require("../utils/pagination");
const { ROLES } = require("../constant/role");

const { Post, Comment, User, sequelize, PostLike } = require("../models");
const { getUser, getPost, getSafeUserInclude } = require("../utils/dbHelper");
const { setCache } = require("../utils/cache");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");

// CREATE POST
exports.createPost = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { content } = req.body;
    const { user, file } = req;

    let imageUrl = null;
    let imagePublicId = null;

    if (file) {
      const uploaded = await uploadToCloudinary(file, "postloop/posts");
      imageUrl = uploaded.secure_url;
      imagePublicId = uploaded.public_id;
    }

    const post = await Post.create(
      {
        content,
        imageUrl,
        imagePublicId,
        userId: user.id,
        likeCount: 0,
        isDeleted: false,
      },
      { transaction },
    );

    await user.increment("postsCount", { transaction });

    await transaction.commit();

    return successResponse(res, {
      statusCode: 201,
      message: "Post created successfully",
      data: post,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// GET ALL POSTS
exports.getAllPosts = async (req, res, next) => {
  try {
    const {
      query: { page = 1, limit = 10, userId },
      user,
    } = req;

    const where = { isDeleted: false };

    if (userId) {
      const targetUser = userId == user.id ? user : await getUser(userId);
      where.userId = targetUser.id;
    }

    const { data, pagination } = await paginate({
      model: Post,
      where,
      page,
      limit,
      include: [getSafeUserInclude()],
    });

    if (req.cacheKey) {
      await setCache(req.cacheKey, {
        data,
        meta: pagination,
        message: "Posts fetched successfully",
      });
    }

    return successResponse(res, {
      message: "Posts fetched successfully",
      data,
      meta: pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET SINGLE POST
exports.getPost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    const post = await Post.findOne({
      where: { id: postId, isDeleted: false },
      include: [getSafeUserInclude()],
    });

    if (!post) throw new ApiError(404, "Post not found");

    if (req.cacheKey) {
      await setCache(req.cacheKey, {
        data: post,
        message: "Post fetched successfully",
      });
    }

    return successResponse(res, {
      message: "Post fetched successfully",
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE POST
exports.updatePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const { user } = req;

    const post = await getPost(postId);

    if (post.userId !== user.id) throw new ApiError(403, "Not authorized");

    const oldData = post.toJSON();

    if (content) post.content = content;

    await post.save();

    const newData = post.toJSON();

    req.activity = {
      entity: "Post",
      entityId: post.id,
      oldData,
      newData,
    };

    return successResponse(res, {
      message: "Post updated successfully",
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE POST
exports.deletePost = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { postId } = req.params;
    const { user } = req;

    const post = await Post.findOne({
      where: { id: postId, isDeleted: false },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!post) {
      throw new ApiError(404, "Post not found");
    }

    if (user.role !== ROLES.ADMIN && post.userId !== user.id) {
      throw new ApiError(403, "Not authorized");
    }

    await post.update({ isDeleted: true, deletedBy: user.id }, { transaction });

    await Comment.update(
      { isDeleted: true, deletedBy: user.id },
      { where: { postId, isDeleted: false }, transaction },
    );

    // safer instance decrement
    const owner = await User.findByPk(post.userId, { transaction });
    if (owner) {
      await owner.decrement("postsCount", { transaction });
    }

    await transaction.commit();

    req.activity = {
      entity: "Post",
      entityId: post.id,
    };

    return successResponse(res, {
      message: "Post deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// LIKE / UNLIKE POST (OPTIMIZED)
exports.likePost = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findOne({
      where: { id: postId, isDeleted: false },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!post) {
      throw new ApiError(404, "Post not found");
    }

    const [like, created] = await PostLike.findOrCreate({
      where: { userId, postId },
      defaults: { userId, postId },
      transaction,
    });

    // UNLIKE
    if (!created) {
      await like.destroy({ transaction });

      await post.decrement("likeCount", { transaction });

      await transaction.commit();

      req.activity = { entity: "PostLike", entityId: postId };

      return successResponse(res, {
        message: "Post unliked",
        data: { likeCount: post.likeCount - 1 },
      });
    }

    // LIKE
    await post.increment("likeCount", { transaction });

    await transaction.commit();

    req.activity = { entity: "PostLike", entityId: postId };

    return successResponse(res, {
      message: "Post liked",
      data: { likeCount: post.likeCount + 1 },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// COMMENTS OF POST
exports.getAllCommentsOfPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    await getPost(postId);

    const { data, pagination } = await paginate({
      model: Comment,
      where: { postId, isDeleted: false },
      page,
      limit,
      include: [getSafeUserInclude()],
    });

    if (req.cacheKey) {
      await setCache(req.cacheKey, {
        data,
        meta: pagination,
        message: "Comments fetched successfully",
      });
    }

    return successResponse(res, {
      message: "Comments fetched successfully",
      data,
      meta: pagination,
    });
  } catch (error) {
    next(error);
  }
};

// SINGLE COMMENT OF POST
exports.getCommentOfPost = async (req, res, next) => {
  try {
    const { postId, commentId } = req.params;

    await getPost(postId);

    const comment = await Comment.findOne({
      where: { id: commentId, postId, isDeleted: false },
      include: [
        getSafeUserInclude(),
        { model: Post, attributes: ["id", "content"] },
      ],
    });

    if (!comment) throw new ApiError(404, "Comment not found");

    if (req.cacheKey) {
      await setCache(req.cacheKey, {
        data: comment,
        message: "Comment fetched successfully",
      });
    }

    return successResponse(res, {
      message: "Comment fetched successfully",
      data: comment,
    });
  } catch (error) {
    next(error);
  }
};
