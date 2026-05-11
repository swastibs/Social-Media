const redis = require("../config/redis");

const TOKEN_PREFIX = "auth:token:";

exports.storeToken = async (token) => {
  await redis.set(`${TOKEN_PREFIX}${token}`, "valid", "EX", 60 * 60 * 24);
};

exports.isTokenValid = async (token) => {
  const value = await redis.get(`${TOKEN_PREFIX}${token}`);
  return value === "valid";
};

exports.deleteToken = async (token) => {
  await redis.del(`${TOKEN_PREFIX}${token}`);
};
