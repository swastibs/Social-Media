const { Post, PostLike, sequelize } = require("../../models");

exports.toggleLike = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const postId = req.params.postId;
        const userId = req.user.id;
        const post = await Post.findOne({ where: { id: postId, isDeleted: false }, transaction });

        if (!post) {
            await transaction.rollback();
            return res.status(404).json({ error: "Post not found" });
        }

        const existing = await PostLike.findOne({ where: { userId, postId }, transaction });

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