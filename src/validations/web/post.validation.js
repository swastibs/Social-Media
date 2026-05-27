/**
 * Post Validations (Web)
 *
 * Joi schemas for creating, updating, and deleting posts.
 */

const { Joi } = require("express-validation");

const removeImage = Joi.boolean()
  .truthy("true")
  .falsy("false")
  .optional()
  .messages({
    "boolean.base": "removeImage must be a boolean",
  });

const id = Joi.number().integer().positive().required().messages({
  "number.base": "Post ID must be a number",
  "number.integer": "Post ID must be an integer",
  "number.positive": "Post ID must be positive",
});

exports.createPostSchema = {
  body: Joi.object({
    content: Joi.string().trim().min(2).required().messages({
      "string.min": "Content must be at least 2 characters",
      "any.required": "Content is required",
    }),
  }).unknown(false),
};

exports.updatePostSchema = {
  params: Joi.object({
    postId: id,
  }),
  body: Joi.object({
    content: Joi.string().trim().min(2).required().messages({
      "string.min": "Content must be at least 2 characters",
      "any.required": "Content is required",
    }),
    removeImage,
  }).unknown(false),
};

exports.postIdParamSchema = {
  params: Joi.object({
    postId: id,
  }),
};
