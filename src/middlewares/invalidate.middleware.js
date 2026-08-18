const { deleteByPattern } = require("../utils/cache");
const {
  API_PATTERNS,
  WEB_PATTERNS,
  combinePatterns,
} = require("../constant/cachePatterns");

exports.invalidateCache = (patterns = []) => {
  return async (req, res, next) => {
    const originalEnd = res.end;
    let responseBody = "";

    const originalJson = res.json;
    res.json = function (body) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    res.end = function (...args) {
      res.end = originalEnd;
      res.end(...args);
    };

    res.on("finish", async () => {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let patternsToDelete = [];

          if (typeof patterns === "function") {
            patternsToDelete = await patterns(req, res, responseBody);
          } else {
            patternsToDelete = patterns;
          }

          for (const pattern of patternsToDelete) {
            if (pattern) {
              await deleteByPattern(pattern);
              console.log(`🗑️ Cache invalidated: ${pattern}`);
            }
          }
        }
      } catch (err) {
        console.error("Cache invalidation error:", err.message);
      }
    });

    next();
  };
};

exports.invalidateUserProfile = (userId) => {
  return exports.invalidateCache([
    API_PATTERNS.USER(userId),
    API_PATTERNS.USERS_LIST(),
    WEB_PATTERNS.PROFILE(userId),
    WEB_PATTERNS.FEED(),
    WEB_PATTERNS.SEARCH(),
  ]);
};

exports.invalidatePost = (userId, postId) => {
  return exports.invalidateCache([
    API_PATTERNS.POST(postId),
    API_PATTERNS.POSTS_LIST(),
    API_PATTERNS.USER_POSTS(userId),
    WEB_PATTERNS.POST(postId),
    WEB_PATTERNS.FEED(),
    WEB_PATTERNS.PROFILE(userId),
    WEB_PATTERNS.SEARCH(),
  ]);
};

exports.invalidatePostLike = (postId, userId) => {
  return exports.invalidateCache([
    API_PATTERNS.POST(postId),
    API_PATTERNS.POSTS_LIST(),
    API_PATTERNS.USER_POSTS(userId),
    WEB_PATTERNS.POST(postId),
    WEB_PATTERNS.FEED(),
    WEB_PATTERNS.PROFILE(userId),
  ]);
};

exports.invalidateComment = (postId, commentId, userId) => {
  return exports.invalidateCache([
    API_PATTERNS.COMMENT(commentId),
    API_PATTERNS.COMMENTS_LIST(),
    API_PATTERNS.POST_COMMENTS(postId),
    API_PATTERNS.USER_COMMENTS(userId),
    WEB_PATTERNS.POST(postId),
    WEB_PATTERNS.FEED(),
    WEB_PATTERNS.PROFILE(userId),
    WEB_PATTERNS.SEARCH(),
  ]);
};

exports.invalidateFollow = (followerId, followingId) => {
  return exports.invalidateCache([
    API_PATTERNS.USER(followerId),
    API_PATTERNS.USER(followingId),
    API_PATTERNS.USER_FOLLOWERS(followingId),
    API_PATTERNS.USER_FOLLOWING(followerId),
    WEB_PATTERNS.PROFILE(followerId),
    WEB_PATTERNS.PROFILE(followingId),
    WEB_PATTERNS.FEED(),
    WEB_PATTERNS.SEARCH(),
  ]);
};

exports.invalidateAdminUserAction = (userId) => {
  return exports.invalidateCache([
    API_PATTERNS.USER(userId),
    API_PATTERNS.USERS_LIST(),
    WEB_PATTERNS.PROFILE(userId),
    WEB_PATTERNS.FEED(),
    WEB_PATTERNS.SEARCH(),
  ]);
};

exports.invalidateAdminPostDelete = (postId, userId) => {
  return exports.invalidateCache([
    API_PATTERNS.POST(postId),
    API_PATTERNS.POSTS_LIST(),
    API_PATTERNS.USER_POSTS(userId),
    WEB_PATTERNS.POST(postId),
    WEB_PATTERNS.FEED(),
    WEB_PATTERNS.PROFILE(userId),
    WEB_PATTERNS.SEARCH(),
    "web:cache:/admin/posts*",
  ]);
};

exports.invalidateAllCache = () => {
  return exports.invalidateCache(["cache:/api/*", "web:cache:*"]);
};

exports.createInvalidationPatterns = (req, res, responseBody) => {
  const patterns = [];
  const userId = req.user?.id;
  const postId = req.params?.postId;
  const commentId = req.params?.commentId;

  if (req.method === "POST") {
    patterns.push(WEB_PATTERNS.FEED(), WEB_PATTERNS.SEARCH());
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    if (req.originalUrl.includes("/profile")) {
      patterns.push(WEB_PATTERNS.PROFILE(userId));
    }
    if (req.originalUrl.includes("/post")) {
      patterns.push(WEB_PATTERNS.POST(postId));
    }
  }

  if (req.method === "DELETE") {
    patterns.push(WEB_PATTERNS.FEED(), WEB_PATTERNS.SEARCH());
  }

  return patterns;
};
