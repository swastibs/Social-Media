const { Comment, Post, sequelize } = require("../../models");
const { getSafeUserInclude } = require("../../utils/dbHelper");
const { deleteByPattern } = require("../../utils/cache");
const { COMMENT_EDIT_WINDOW_MINUTES } = require("../../constant/editWindow");

const isEditable = (commentCreatedAt) => {
  const now = new Date();
  const createdAt = new Date(commentCreatedAt);
  const diffMinutes = (now - createdAt) / (1000 * 60);
  return diffMinutes <= COMMENT_EDIT_WINDOW_MINUTES;
};

exports.createComment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { postId, content } = req.body;
    const userId = req.user.id;

    const post = await Post.findByPk(postId, { transaction });
    if (!post || post.isDeleted) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const comment = await Comment.create(
      { postId, userId, content, isDeleted: false },
      { transaction },
    );
    await transaction.commit();

    await deleteByPattern(`web:cache:/post/${postId}*`);
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern("web:cache:/search*");

    const newComment = await Comment.findByPk(comment.id, {
      include: [
        getSafeUserInclude({
          attributes: [
            "id",
            "name",
            "profilePictureUrl",
            "thumbnailUrl",
            "isVerified",
          ],
        }),
      ],
    });

    const commentCount = await Comment.count({
      where: { postId, isDeleted: false },
    });

    return res.json({
      success: true,
      message: "Comment added",
      comment: {
        id: newComment.id,
        content: newComment.content,
        createdAt: newComment.createdAt,
        User: newComment.User,
        canEdit: true,
        canDelete: true,
      },
      commentCount,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.updateComment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const comment = await Comment.findOne({
      where: { id: commentId, isDeleted: false },
      transaction,
    });
    if (!comment) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    if (comment.userId !== userId) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (!isEditable(comment.createdAt)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Edit window expired (15 minutes only)",
      });
    }

    const oldData = comment.toJSON();
    comment.content = content;
    await comment.save({ transaction });
    await transaction.commit();

    await deleteByPattern(`web:cache:/post/${comment.postId}*`);
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern("web:cache:/search*");

    req.activity = {
      entity: "Comment",
      entityId: comment.id,
      oldData,
      newData: comment.toJSON(),
    };

    return res.json({ success: true, message: "Comment updated", content });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.deleteComment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const comment = await Comment.findOne({
      where: { id: commentId, isDeleted: false },
      include: [{ model: Post, attributes: ["userId"] }],
      transaction,
    });
    if (!comment) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    const isOwner = comment.userId === userId;
    const isPostOwner = comment.Post && comment.Post.userId === userId;
    const isAdmin = userRole === "admin";

    if (!isOwner && !isPostOwner && !isAdmin) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this comment",
      });
    }

    await comment.update(
      { isDeleted: true, deletedBy: userId },
      { transaction },
    );
    await transaction.commit();

    await deleteByPattern(`web:cache:/post/${comment.postId}*`);
    await deleteByPattern("web:cache:/feed*");
    await deleteByPattern("web:cache:/search*");

    req.activity = {
      entity: "Comment",
      entityId: comment.id,
    };

    const commentCount = await Comment.count({
      where: { postId: comment.postId, isDeleted: false },
    });

    return res.json({
      success: true,
      message: "Comment deleted",
      commentCount,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
