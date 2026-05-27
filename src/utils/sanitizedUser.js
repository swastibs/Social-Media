/**
 * User Sanitization Utility
 *
 * Removes sensitive fields from a user object before sending it to the client.
 * Prevents accidental exposure of password hash, internal timestamps, etc.
 */

/**
 * Sanitizes a user object by removing sensitive and internal fields.
 * @param {Object|Model} user - User instance or plain object (from Sequelize)
 * @returns {Object|null} Sanitized user object without password, createdAt, updatedAt
 */
exports.sanitizedUser = (user) => {
  if (!user) return null;

  // Convert Sequelize model instance to plain JSON if needed
  const obj = user.toJSON ? user.toJSON() : user;

  // Remove sensitive fields
  const { password, createdAt, updatedAt, ...safeUser } = obj;

  return safeUser;
};
