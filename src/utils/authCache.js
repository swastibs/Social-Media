const jwt = require("jsonwebtoken");
const redis = require("../config/redis");

const BLACKLIST_PREFIX = "blacklist:token:";
const USER_TOKENS_PREFIX = "user:tokens:";

exports.storeToken = async (token, userId) => {
  if (userId) {
    await redis.sadd(`${USER_TOKENS_PREFIX}${userId}`, token);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        ignoreExpiration: true,
      });
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0)
        await redis.expire(`${USER_TOKENS_PREFIX}${userId}`, expiresIn);
    } catch (err) {
      await redis.expire(`${USER_TOKENS_PREFIX}${userId}`, 24 * 60 * 60);
    }
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

    if (expiresIn > 0)
      await redis.set(
        `${BLACKLIST_PREFIX}${token}`,
        "revoked",
        "EX",
        expiresIn,
      );

    if (decoded.userId)
      await redis.srem(`${USER_TOKENS_PREFIX}${decoded.userId}`, token);
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
