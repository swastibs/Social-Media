/**
 * Authentication Cache Utilities
 *
 * Manages JWT token storage and validation using Redis.
 * Supports:
 * - Token blacklisting (logout)
 * - User token set management (for invalidating all user sessions)
 * - Session limit (maximum concurrent devices)
 */

const jwt = require("jsonwebtoken");
const redis = require("../config/redis");

const BLACKLIST_PREFIX = "blacklist:token:";
const USER_TOKENS_PREFIX = "user:tokens:";
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS_PER_USER || "0", 10);

/**
 * Stores a token in the user's token set for session management.
 * If MAX_SESSIONS > 0, it will remove oldest token(s) to enforce limit.
 * @param {string} token - JWT token
 * @param {number} userId - User ID
 */
exports.storeToken = async (token, userId) => {
  if (!userId) return;

  const userKey = `${USER_TOKENS_PREFIX}${userId}`;

  // Add the new token
  await redis.sadd(userKey, token);

  // Enforce session limit if configured
  if (MAX_SESSIONS > 0) {
    const tokenCount = await redis.scard(userKey);
    if (tokenCount > MAX_SESSIONS) {
      // Get all tokens, sort by creation time (approximate using token expiration)
      const tokens = await redis.smembers(userKey);
      // Decode each token to get its iat (issued at) timestamp
      const tokensWithIat = [];
      for (const t of tokens) {
        try {
          const decoded = jwt.decode(t);
          if (decoded && decoded.iat) {
            tokensWithIat.push({ token: t, iat: decoded.iat });
          } else {
            tokensWithIat.push({ token: t, iat: 0 });
          }
        } catch {
          tokensWithIat.push({ token: t, iat: 0 });
        }
      }
      // Sort by iat (oldest first)
      tokensWithIat.sort((a, b) => a.iat - b.iat);
      const toRemove = tokensWithIat.slice(0, tokenCount - MAX_SESSIONS);
      for (const { token: oldToken } of toRemove) {
        await exports.deleteToken(oldToken); // blacklist and remove from set
      }
    }
  }

  // Set expiry on the user's token set based on the new token's expiration
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: true,
    });
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    if (expiresIn > 0) {
      await redis.expire(userKey, expiresIn);
    }
  } catch (err) {
    // Fallback: 1 day
    await redis.expire(userKey, 24 * 60 * 60);
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

/**
 * Returns all active sessions (tokens) for a user with decoded info.
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Array of session objects { tokenPrefix, iat, exp, deviceInfo? }
 */
exports.getUserSessions = async (userId) => {
  const tokens = await redis.smembers(`${USER_TOKENS_PREFIX}${userId}`);
  const sessions = [];
  for (const token of tokens) {
    try {
      const decoded = jwt.decode(token);
      if (decoded) {
        sessions.push({
          tokenPrefix: token.substring(0, 10) + "...",
          iat: decoded.iat ? new Date(decoded.iat * 1000) : null,
          exp: decoded.exp ? new Date(decoded.exp * 1000) : null,
          // Optionally extract device info from token payload if stored
        });
      } else {
        sessions.push({
          tokenPrefix: token.substring(0, 10) + "...",
          iat: null,
          exp: null,
        });
      }
    } catch {
      sessions.push({
        tokenPrefix: token.substring(0, 10) + "...",
        iat: null,
        exp: null,
      });
    }
  }
  return sessions;
};
