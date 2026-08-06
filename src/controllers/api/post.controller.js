const ApiError = require("../../utils/ApiError");
const { successResponse } = require("../../utils/ApiResponse");
const { paginate } = require("../../utils/pagination");
const { ROLES } = require("../../constant/role");

const {
  Post,
  Comment,
  User,
  sequelize,
  PostLike,
  UserFollow,
} = require("../../models");
const {
  getUser,
  getPost,
  getSafeUserInclude,
} = require("../../utils/dbHelper");
const {
  setCache,
  invalidatePostCache,
  invalidateUserCache,
  invalidateFeedCache,
} = require("../../utils/cache");
const { uploadToMinio, deleteFromMinioByUrl } = require("../../config/minio");
const { Op } = require("sequelize");

// CREATE POST
exports.createPost = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { content } = req.body;
    const { user, file } = req;

    let imageUrl = null,
      thumbnailUrl = null;

    if (file) {
      const result = await uploadToMinio(
        file.buffer,
        file.originalname,
        "posts",
        { thumbnailSize: 400 }, // feed card thumbnail
      );
      imageUrl = result.url;
      thumbnailUrl = result.thumbnailUrl;
    }

    const post = await Post.create(
      {
        content,
        imageUrl,
        thumbnailUrl,
        userId: user.id,
        likeCount: 0,
        isDeleted: false,
      },
      { transaction },
    );

    await user.increment("postsCount", { transaction });
    await transaction.commit();

    // ✅ INVALIDATE ALL RELEVANT CACHES
    await deleteByPattern(`cache:/api/users/${user.id}/posts*`);
    await deleteByPattern(`cache:/api/users/${user.id}*`);
    await deleteByPattern(`cache:/api/posts*`);
    await deleteByPattern(`web:cache:/feed*`);
    await deleteByPattern(`web:cache:/profile/${user.id}*`);
    await deleteByPattern(`web:cache:/search*`);

    console.log(`🗑️ Cache invalidated for user ${user.id} posts`);

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

    // --- ADD THIS BLOCK: add liked flag for current user ---
    let likedMap = {};
    if (user && data.length) {
      const postIds = data.map((p) => p.id);
      const likes = await PostLike.findAll({
        where: { userId: user.id, postId: { [Op.in]: postIds } },
        attributes: ["postId"],
      });
      likedMap = likes.reduce((map, like) => {
        map[like.postId] = true;
        return map;
      }, {});
    }

    const postsWithLiked = data.map((post) => ({
      ...post.toJSON(),
      liked: likedMap[post.id] || false,
    }));
    likedMap = null;
    // --- END ADD ---

    if (req.cacheKey)
      await setCache(req.cacheKey, {
        data: postsWithLiked,
        meta: pagination,
        message: "Posts fetched successfully",
      });

    return successResponse(res, {
      message: "Posts fetched successfully",
      data: postsWithLiked,
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

    if (req.cacheKey)
      await setCache(req.cacheKey, {
        data: post,
        message: "Post fetched successfully",
      });

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
    const { content, removeImage } = req.body;
    const { user, file } = req;

    const post = await getPost(postId);
    if (post.userId !== user.id) throw new ApiError(403, "Not authorized");

    const oldData = post.toJSON();
    if (content) post.content = content;

    if (file) {
      if (post.imageUrl) await deleteFromMinioByUrl(post.imageUrl);
      const result = await uploadToMinio(
        file.buffer,
        file.originalname,
        "posts",
        { thumbnailSize: 400 },
      );
      post.imageUrl = result.url;
      post.thumbnailUrl = result.thumbnailUrl;
    }

    if (removeImage === "true" && post.imageUrl) {
      await deleteFromMinioByUrl(post.imageUrl);
      post.imageUrl = null;
      post.thumbnailUrl = null;
    }

    await post.save();
    const newData = post.toJSON();

    // ✅ INVALIDATE ALL RELEVANT CACHES
    await deleteByPattern(`cache:/api/users/${user.id}/posts*`);
    await deleteByPattern(`cache:/api/users/${user.id}*`);
    await deleteByPattern(`cache:/api/posts/${postId}`);
    await deleteByPattern(`cache:/api/posts*`);
    await deleteByPattern(`web:cache:/post/${postId}*`);
    await deleteByPattern(`web:cache:/feed*`);
    await deleteByPattern(`web:cache:/profile/${user.id}*`);
    await deleteByPattern(`web:cache:/search*`);

    req.activity = { entity: "Post", entityId: post.id, oldData, newData };

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

    if (!post) throw new ApiError(404, "Post not found");

    if (user.role !== ROLES.ADMIN && post.userId !== user.id)
      throw new ApiError(403, "Not authorized");

    await post.update({ isDeleted: true, deletedBy: user.id }, { transaction });

    await Comment.update(
      { isDeleted: true, deletedBy: user.id },
      { where: { postId, isDeleted: false }, transaction },
    );

    const owner = await User.findByPk(post.userId, { transaction });
    if (owner) await owner.decrement("postsCount", { transaction });

    await transaction.commit();

    // ✅ INVALIDATE ALL RELEVANT CACHES
    await deleteByPattern(`cache:/api/users/${post.userId}/posts*`);
    await deleteByPattern(`cache:/api/users/${post.userId}*`);
    await deleteByPattern(`cache:/api/posts/${postId}`);
    await deleteByPattern(`cache:/api/posts*`);
    await deleteByPattern(`web:cache:/post/${postId}*`);
    await deleteByPattern(`web:cache:/feed*`);
    await deleteByPattern(`web:cache:/profile/${post.userId}*`);
    await deleteByPattern(`web:cache:/search*`);

    console.log(`🗑️ Cache invalidated for post ${postId}`);

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
      await transaction.rollback();
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
        data: { likeCount: post.likeCount - 1, liked: false },
      });
    }

    // LIKE
    await post.increment("likeCount", { transaction });
    await transaction.commit();
    req.activity = { entity: "PostLike", entityId: postId };
    return successResponse(res, {
      message: "Post liked",
      data: { likeCount: post.likeCount + 1, liked: true },
    });
  } catch (error) {
    // Only rollback if the transaction is still active
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

// GET FEED POSTS (from followed users)
exports.getFeed = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    // Find users that the current user follows
    const followedUsers = await UserFollow.findAll({
      where: { followerId: userId },
      attributes: ["followingId"],
      raw: true,
    });

    const followingIds = followedUsers.map((f) => f.followingId);

    // If not following anyone, return empty array
    if (followingIds.length === 0) {
      return successResponse(res, {
        message: "Feed fetched successfully",
        data: [],
        meta: {
          totalRecords: 0,
          currentPage: 1,
          totalPages: 1,
          limit: parseInt(limit),
        },
      });
    }

    const { data, pagination } = await paginate({
      model: Post,
      where: {
        userId: { [Op.in]: followingIds },
        isDeleted: false,
      },
      page,
      limit,
      include: [getSafeUserInclude()],
      order: [["createdAt", "DESC"]],
    });

    if (req.cacheKey) {
      await setCache(req.cacheKey, {
        data,
        meta: pagination,
        message: "Feed fetched successfully",
      });
    }

    return successResponse(res, {
      message: "Feed fetched successfully",
      data,
      meta: pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL COMMENTS OF POST
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

// GET SINGLE COMMENT OF POST
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
