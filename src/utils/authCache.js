const redis = require("../config/redis");

const TOKEN_PREFIX = "auth:token:";
const USER_TOKENS_PREFIX = "user:tokens:";

exports.storeToken = async (token, userId) => {
  await redis.set(`${TOKEN_PREFIX}${token}`, "valid", "EX", 60 * 60 * 24);

  if (userId) {
    await redis.sadd(`${USER_TOKENS_PREFIX}${userId}`, token);
    await redis.expire(`${USER_TOKENS_PREFIX}${userId}`, 60 * 60 * 24);
  }
};

exports.isTokenValid = async (token) => {
  const value = await redis.get(`${TOKEN_PREFIX}${token}`);
  return value === "valid";
};

exports.deleteToken = async (token) => {
  await redis.del(`${TOKEN_PREFIX}${token}`);
};

exports.deleteAllUserTokens = async (userId) => {
  if (!userId) return;

  const tokens = await redis.smembers(`${USER_TOKENS_PREFIX}${userId}`);

  for (const token of tokens) await redis.del(`${TOKEN_PREFIX}${token}`);

  await redis.del(`${USER_TOKENS_PREFIX}${userId}`);
};

exports.removeTokenFromUser = async (userId, token) => {
  if (userId && token)
    await redis.srem(`${USER_TOKENS_PREFIX}${userId}`, token);
};
