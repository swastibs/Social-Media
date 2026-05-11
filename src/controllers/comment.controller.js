const ApiError = require("../utils/ApiError");
const { successResponse } = require("../utils/ApiResponse");
const { paginate } = require("../utils/pagination");
const { ROLES } = require("../constant/role");

const { Post, Comment, User, sequelize } = require("../models");
const {
  getPost,
  getComment,
  getSafeUserInclude,
} = require("../utils/dbHelper");
const { setCache } = require("../utils/cache");

// CREATE COMMENT
exports.createComment = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      body: { postId, content },
      user,
    } = req;

    await getPost(postId);

    const comment = await Comment.create(
      {
        postId,
        userId: user.id,
        content,
        isDeleted: false,
      },
      { transaction },
    );

    await transaction.commit();

    req.activity = {
      entity: "Comment",
      entityId: comment.id,
    };

    return successResponse(res, {
      statusCode: 201,
      message: "Comment created successfully",
      data: comment,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// GET ALL COMMENTS
exports.getAllComments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const { data, pagination } = await paginate({
      model: Comment,
      where: { isDeleted: false },
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

// GET SINGLE COMMENT
exports.getComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findOne({
      where: { id: commentId, isDeleted: false },
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

// UPDATE COMMENT
exports.updateComment = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const { user } = req;

    const targetComment = await getComment(commentId);

    if (targetComment.userId !== user.id)
      throw new ApiError(403, "Not authorized");

    const oldData = targetComment.toJSON();

    if (content && content !== targetComment.content)
      targetComment.content = content;

    await targetComment.save({ transaction });

    await transaction.commit();

    const newData = targetComment.toJSON();

    req.activity = {
      entity: "Comment",
      entityId: targetComment.id,
      oldData,
      newData,
    };

    return successResponse(res, {
      message: "Comment updated successfully",
      data: targetComment,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// DELETE COMMENT
exports.deleteComment = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { commentId } = req.params;
    const { user } = req;

    const targetComment = await getComment(commentId);

    const post = await Post.findByPk(targetComment.postId, {
      transaction,
    });

    if (!post) throw new ApiError(404, "Post not found");

    if (
      user.role !== ROLES.ADMIN &&
      targetComment.userId !== user.id &&
      post.userId !== user.id
    )
      throw new ApiError(403, "Not authorized");

    await targetComment.update(
      { isDeleted: true, deletedBy: user.id },
      { transaction },
    );

    await transaction.commit();

    req.activity = {
      entity: "Comment",
      entityId: targetComment.id,
      oldData: null,
      newData: null,
    };

    return successResponse(res, {
      message: "Comment deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
