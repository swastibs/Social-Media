const jwt = require("jsonwebtoken");
const redis = require("../config/redis");

const BLACKLIST_PREFIX = "blacklist:token:";
const USER_TOKENS_PREFIX = "user:tokens:";
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS_PER_USER || "0", 10);

exports.storeToken = async (token, userId) => {
  if (!userId) return;

  const userKey = `${USER_TOKENS_PREFIX}${userId}`;

  await redis.sadd(userKey, token);

  if (MAX_SESSIONS > 0) {
    const tokenCount = await redis.scard(userKey);
    if (tokenCount > MAX_SESSIONS) {
      const tokens = await redis.smembers(userKey);

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

      tokensWithIat.sort((a, b) => a.iat - b.iat);
      const toRemove = tokensWithIat.slice(0, tokenCount - MAX_SESSIONS);
      for (const { token: oldToken } of toRemove) {
        await exports.deleteToken(oldToken);
      }
    }
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: true,
    });
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    if (expiresIn > 0) {
      await redis.expire(userKey, expiresIn);
    }
  } catch (err) {
    await redis.expire(userKey, 24 * 60 * 60);
  }
};

exports.isTokenValid = async (token) => {
  const blacklisted = await redis.get(`${BLACKLIST_PREFIX}${token}`);
  return blacklisted === null;
};

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

exports.deleteAllUserTokens = async (userId) => {
  if (!userId) return;

  const tokens = await redis.smembers(`${USER_TOKENS_PREFIX}${userId}`);

  for (const token of tokens) {
    await exports.deleteToken(token);
  }

  await redis.del(`${USER_TOKENS_PREFIX}${userId}`);
};

exports.removeTokenFromUser = async (userId, token) => {
  if (userId && token) {
    await redis.srem(`${USER_TOKENS_PREFIX}${userId}`, token);
  }
};

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
