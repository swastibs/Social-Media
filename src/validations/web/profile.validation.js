/**
 * Profile Validations (Web)
 *
 * Joi schemas for userId parameter and profile update form.
 */

const { Joi } = require("express-validation");

// For userId parameter validation
exports.userIdParamSchema = {
  params: Joi.object({
    userId: Joi.number().integer().positive().required().messages({
      "number.base": "User ID must be a number",
      "number.integer": "User ID must be an integer",
      "number.positive": "User ID must be a positive number",
      "any.required": "User ID is required",
    }),
  }),
};

// For update profile validation
exports.updateProfileSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(16).required().messages({
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name cannot exceed 16 characters",
      "any.required": "Name is required",
    }),
    bio: Joi.string().trim().max(150).allow(null, "").messages({
      "string.max": "Bio cannot exceed 150 characters",
    }),
    removeImage: Joi.string().valid("true", "false").optional(),
    isPrivate: Joi.boolean().optional(),
  }).unknown(false),
};
