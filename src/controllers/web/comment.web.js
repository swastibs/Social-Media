/**
 * Comment Controller (Web)
 *
 * Handles:
 * - Creating a comment (AJAX)
 * - Updating a comment (AJAX) – allowed within 15 minutes of creation
 * - Deleting a comment (AJAX) – allowed for comment owner, post owner, or admin
 */

const { Comment, Post, sequelize } = require("../../models");
const { getSafeUserInclude } = require("../../utils/dbHelper");
const { deleteByPattern } = require("../../utils/cache");

/**
 * Helper: Check if comment is still editable (within 15 minutes of creation)
 */
const isEditable = (commentCreatedAt) => {
  const now = new Date();
  const createdAt = new Date(commentCreatedAt);
  const diffMinutes = (now - createdAt) / (1000 * 60);
  return diffMinutes <= 15;
};

// ========== CREATE COMMENT (AJAX) ==========
exports.createComment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { postId, content } = req.body;
    const userId = req.user.id;

    // Check if post exists
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

    // Fetch the comment with user info for immediate display
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

    // Get updated comment count for the post
    const commentCount = await Comment.count({
      where: { postId, isDeleted: false },
    });

    // Invalidate post cache to reflect new comment count
    await deleteByPattern(`web:cache:/post/${postId}*`);

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

// ========== UPDATE COMMENT (AJAX) – 15‑minute edit window ==========
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

    // Capture old data for activity log
    const oldData = comment.toJSON();
    comment.content = content;
    await comment.save({ transaction });
    await transaction.commit();

    // Attach activity data
    req.activity = {
      entity: "Comment",
      entityId: comment.id,
      oldData,
      newData: comment.toJSON(),
    };

    // Invalidate post cache
    await deleteByPattern(`web:cache:/post/${comment.postId}*`);

    return res.json({ success: true, message: "Comment updated", content });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// ========== DELETE COMMENT (AJAX) ==========
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

    // Attach activity data
    req.activity = {
      entity: "Comment",
      entityId: comment.id,
    };

    // Get updated comment count
    const commentCount = await Comment.count({
      where: { postId: comment.postId, isDeleted: false },
    });

    // Invalidate post cache
    await deleteByPattern(`web:cache:/post/${comment.postId}*`);

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
