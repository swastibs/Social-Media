const { Comment, Post, User, sequelize } = require("../../models");
const { getSafeUserInclude } = require("../../utils/dbHelper");
const { Op } = require("sequelize");
const ApiError = require("../../utils/ApiError");

// Helper to check if comment is still editable (within 15 minutes of creation)
const isEditable = (commentCreatedAt) => {
    const now = new Date();
    const createdAt = new Date(commentCreatedAt);
    const diffMinutes = (now - createdAt) / (1000 * 60);
    return diffMinutes <= 1;
};

// CREATE COMMENT (AJAX)
exports.createComment = async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
        const { postId, content } = req.body;
        const userId = req.user.id;

        // Check if post exists
        const post = await Post.findByPk(postId, { transaction });
        if (!post || post.isDeleted) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        const comment = await Comment.create(
            { postId, userId, content, isDeleted: false },
            { transaction }
        );
        await transaction.commit();

        // Fetch the comment with user info for immediate display
        const newComment = await Comment.findByPk(comment.id, {
            include: [getSafeUserInclude({ attributes: ["id", "name", "profilePictureUrl"] })],
        });

        // Increment comment count on post (optional, but we'll return the new count)
        const commentCount = await Comment.count({ where: { postId, isDeleted: false } });

        return res.json({
            success: true,
            message: "Comment added",
            comment: {
                id: newComment.id,
                content: newComment.content,
                createdAt: newComment.createdAt,
                User: newComment.User,
                canEdit: true, // newly created comment can be edited
                canDelete: true,
            },
            commentCount,
        });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};

// UPDATE COMMENT (AJAX) – with 15‑minute restriction
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
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        if (comment.userId !== userId) {
            await transaction.rollback();
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        if (!isEditable(comment.createdAt)) {
            await transaction.rollback();
            return res.status(403).json({ success: false, message: "Edit window expired (15 minutes only)" });
        }

        comment.content = content;
        await comment.save({ transaction });
        await transaction.commit();

        return res.json({ success: true, message: "Comment updated", content });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};

// DELETE COMMENT (AJAX) – allowed for comment owner, post owner, or admin
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
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        const isOwner = comment.userId === userId;
        const isPostOwner = comment.Post && comment.Post.userId === userId;
        const isAdmin = userRole === "admin";

        if (!isOwner && !isPostOwner && !isAdmin) {
            await transaction.rollback();
            return res.status(403).json({ success: false, message: "Not authorized to delete this comment" });
        }

        await comment.update({ isDeleted: true, deletedBy: userId }, { transaction });
        await transaction.commit();

        // Get updated comment count
        const commentCount = await Comment.count({ where: { postId: comment.postId, isDeleted: false } });

        return res.json({ success: true, message: "Comment deleted", commentCount });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};