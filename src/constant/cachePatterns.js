const API_PATTERNS = {
  USER: (userId) => `cache:/api/users/${userId}*`,
  USERS_LIST: () => "cache:/api/users?*",
  USER_POSTS: (userId) => `cache:/api/users/${userId}/posts*`,
  USER_POST: (userId, postId) => `cache:/api/users/${userId}/posts/${postId}`,
  USER_COMMENTS: (userId) => `cache:/api/users/${userId}/comments*`,
  USER_COMMENT: (userId, commentId) =>
    `cache:/api/users/${userId}/comments/${commentId}`,
  USER_FOLLOWERS: (userId) => `cache:/api/users/${userId}/followers*`,
  USER_FOLLOWING: (userId) => `cache:/api/users/${userId}/following*`,

  POSTS_LIST: () => "cache:/api/posts*",
  POST: (postId) => `cache:/api/posts/${postId}`,
  POST_COMMENTS: (postId) => `cache:/api/posts/${postId}/comments*`,
  POST_COMMENT: (postId, commentId) =>
    `cache:/api/posts/${postId}/comments/${commentId}`,

  COMMENTS_LIST: () => "cache:/api/comments*",
  COMMENT: (commentId) => `cache:/api/comments/${commentId}`,

  ACTIVITIES: () => "cache:/api/activities*",
  ACTIVITY_STATS: () => "cache:/api/activities/stats*",

  ALL_API: () => "cache:/api/*",
};

const WEB_PATTERNS = {
  PROFILE: (userId) => `web:cache:/profile/${userId}*`,
  PROFILE_FOLLOWERS: (userId) => `web:cache:/profile/${userId}/followers*`,
  PROFILE_FOLLOWING: (userId) => `web:cache:/profile/${userId}/following*`,
  PROFILE_EDIT: (userId) => `web:cache:/profile/edit*`,

  FEED: () => "web:cache:/feed*",

  POST: (postId) => `web:cache:/post/${postId}*`,
  POST_CREATE: () => "web:cache:/post/create*",
  POST_EDIT: (postId) => `web:cache:/post/edit/${postId}*`,

  SEARCH: () => "web:cache:/search*",

  FOLLOW_REQUESTS: () => "web:cache:/follow-requests*",

  ALL_WEB: () => "web:cache:*",
};

const combinePatterns = (...patternArrays) => {
  return patternArrays.flat().filter(Boolean);
};

module.exports = {
  API_PATTERNS,
  WEB_PATTERNS,
  combinePatterns,
};
