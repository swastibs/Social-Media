/**
 * Authentication Cache Utilities
 *
 * Manages JWT token storage and validation using Redis.
 * Supports:
 * - Token blacklisting (logout)
 * - User token set management (for invalidating all user sessions)
 */

const jwt = require("jsonwebtoken");
const redis = require("../config/redis");

const BLACKLIST_PREFIX = "blacklist:token:";
const USER_TOKENS_PREFIX = "user:tokens:";

/**
 * Stores a token in the user's token set for session management.
 * @param {string} token - JWT token
 * @param {number} userId - User ID
 */
exports.storeToken = async (token, userId) => {
  if (userId) {
    await redis.sadd(`${USER_TOKENS_PREFIX}${userId}`, token);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        ignoreExpiration: true,
      });
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        await redis.expire(`${USER_TOKENS_PREFIX}${userId}`, expiresIn);
      }
    } catch (err) {
      // Fallback: set expiry to 1 day if token invalid
      await redis.expire(`${USER_TOKENS_PREFIX}${userId}`, 24 * 60 * 60);
    }
  }
};

/**
 * Checks if a token is valid (not blacklisted).
 * @param {string} token - JWT token
 * @returns {Promise<boolean>}
 */
exports.isTokenValid = async (token) => {
  const blacklisted = await redis.get(`${BLACKLIST_PREFIX}${token}`);
  return blacklisted === null;
};

/**
 * Blacklists a token and removes it from the user's token set.
 * @param {string} token - JWT token
 */
exports.deleteToken = async (token) => {
  if (!token) return;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: true,
    });
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    if (expiresIn > 0) {
      await redis.set(
        `${BLACKLIST_PREFIX}${token}`,
        "revoked",
        "EX",
        expiresIn,
      );
    }

    if (decoded.userId) {
      await redis.srem(`${USER_TOKENS_PREFIX}${decoded.userId}`, token);
    }
  } catch (err) {
    console.error("deleteToken error:", err.message);
  }
};

/**
 * Blacklists all tokens belonging to a user (global logout).
 * @param {number} userId - User ID
 */
exports.deleteAllUserTokens = async (userId) => {
  if (!userId) return;

  const tokens = await redis.smembers(`${USER_TOKENS_PREFIX}${userId}`);

  for (const token of tokens) {
    await exports.deleteToken(token);
  }

  await redis.del(`${USER_TOKENS_PREFIX}${userId}`);
};

/**
 * Removes a single token from a user's token set (partial logout).
 * @param {number} userId - User ID
 * @param {string} token - JWT token
 */
exports.removeTokenFromUser = async (userId, token) => {
  if (userId && token) {
    await redis.srem(`${USER_TOKENS_PREFIX}${userId}`, token);
  }
};
