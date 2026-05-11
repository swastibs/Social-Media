exports.sanitizedUser = (user) => {
  if (!user) return null;
  const obj = user.toJSON ? user.toJSON() : user;
  const { password, createdAt, updatedAt, ...safeUser } = obj;
  return safeUser;
};
