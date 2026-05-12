const { Joi } = require("express-validation");

const email = Joi.string().email().lowercase().trim().messages({
  "string.email": "Please enter a valid email address",
  "any.required": "Email is required",
});

const password = Joi.string().trim().min(4).max(32).messages({
  "string.min": "Password must be at least 4 characters",
  "string.max": "Password cannot exceed 32 characters",
});

exports.webSignUpSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(16).required().messages({
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name cannot exceed 16 characters",
      "any.required": "Name is required",
    }),
    email: email.required(),
    password: password.required(),
    bio: Joi.string().trim().max(500).allow(null, "").messages({
      "string.max": "Bio cannot exceed 500 characters",
    }),
  }).unknown(false),
};

exports.webLoginSchema = {
  body: Joi.object({
    email: email.required(),
    password: Joi.string().trim().required().messages({
      "any.required": "Password is required",
    }),
  }).unknown(false),
};

exports.changePasswordSchema = {
  body: Joi.object({
    oldPassword: Joi.string().required().messages({
      "any.required": "Old password is required",
    }),
    newPassword: Joi.string().min(4).max(32).required().messages({
      "string.min": "New password must be at least 4 characters",
      "string.max": "New password cannot exceed 32 characters",
      "any.required": "New password is required",
    }),
    confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
      "any.only": "Passwords do not match",
      "any.required": "Please confirm your new password",
    }),
  }).unknown(false),
};