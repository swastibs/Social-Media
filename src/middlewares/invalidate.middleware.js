/**
 * Universal Cache Invalidation Middleware
 * Deletes Redis cache keys matching provided patterns after successful response
 */

const { deleteByPattern } = require("../utils/cache");
const {
  API_PATTERNS,
  WEB_PATTERNS,
  combinePatterns,
} = require("../constant/cachePatterns");

/**
 * Creates middleware that invalidates cache patterns after response finishes.
 * @param {string[]|Function} patterns - Array of Redis key patterns or a function that returns patterns based on req/res
 * @returns {Function} Express middleware
 */
exports.invalidateCache = (patterns = []) => {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;
    let responseBody = "";

    // Capture response body if needed for pattern generation
    const originalJson = res.json;
    res.json = function (body) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    res.end = function (...args) {
      res.end = originalEnd;
      res.end(...args);
    };

    // Attach listener to invalidate cache after response is sent
    res.on("finish", async () => {
      try {
        // Only invalidate on successful mutations (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let patternsToDelete = [];

          // If patterns is a function, call it to get patterns dynamically
          if (typeof patterns === "function") {
            patternsToDelete = await patterns(req, res, responseBody);
          } else {
            patternsToDelete = patterns;
          }

          // Delete all patterns
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

/**
 * Pre-defined cache invalidation strategies for common operations
 */

// When a user updates their profile
exports.invalidateUserProfile = (userId) => {
  return exports.invalidateCache([
    API_PATTERNS.USER(userId),
    API_PATTERNS.USERS_LIST(),
    WEB_PATTERNS.PROFILE(userId),
    WEB_PATTERNS.FEED(),
    WEB_PATTERNS.SEARCH(),
  ]);
};

// When a user creates/updates/deletes a post
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

// When a user likes/unlikes a post
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

// When a user creates/updates/deletes a comment
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

// When a user follows/unfollows another user
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

// When admin performs user actions (activate/deactivate/delete)
exports.invalidateAdminUserAction = (userId) => {
  return exports.invalidateCache([
    API_PATTERNS.USER(userId),
    API_PATTERNS.USERS_LIST(),
    WEB_PATTERNS.PROFILE(userId),
    WEB_PATTERNS.FEED(),
    WEB_PATTERNS.SEARCH(),
  ]);
};

// When admin deletes a post
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

// Invalidate everything (use sparingly - e.g., after database seeding)
exports.invalidateAllCache = () => {
  return exports.invalidateCache(["cache:/api/*", "web:cache:*"]);
};

// Dynamic pattern generator for custom use cases
exports.createInvalidationPatterns = (req, res, responseBody) => {
  const patterns = [];
  const userId = req.user?.id;
  const postId = req.params?.postId;
  const commentId = req.params?.commentId;

  // Add patterns based on request method and URL
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
