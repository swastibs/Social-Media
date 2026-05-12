const { Joi } = require("express-validation");

const email = Joi.string().email().lowercase().trim();
const password = Joi.string().trim().min(4).max(32);

exports.signUpSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(16).required(),
    email: email.required(),
    password: password.required(),
    bio: Joi.string().trim().max(500).allow(null, ""),
  }).unknown(false),

  params: Joi.object().max(0),
  query: Joi.object().max(0),
};

exports.logInSchema = {
  body: Joi.object({
    email: email.required(),
    password: Joi.string().trim().required(),
  }).unknown(false),

  params: Joi.object().max(0),
  query: Joi.object().max(0),
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
  }).unknown(false),
};