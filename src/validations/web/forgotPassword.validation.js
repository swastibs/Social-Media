/**
 * Forgot Password Validations (Web)
 *
 * Joi schemas for requesting password reset and resetting password.
 */

const { Joi } = require("express-validation");

exports.forgotPasswordSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please enter a valid email address",
      "any.required": "Email address is required",
    }),
  }).unknown(false),
};

exports.resetPasswordSchema = {
  body: Joi.object({
    token: Joi.string().required().messages({
      "any.required": "Reset token is required",
    }),
    password: Joi.string().min(4).max(32).required().messages({
      "string.min": "Password must be at least 4 characters",
      "string.max": "Password cannot exceed 32 characters",
      "any.required": "New password is required",
    }),
  }).unknown(false),
};
