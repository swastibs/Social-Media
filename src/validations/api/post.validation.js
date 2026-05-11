const { Joi } = require("express-validation");

const id = Joi.number().integer().positive().required().messages({
  "number.base": "ID must be a number",
  "number.integer": "ID must be an integer",
  "number.positive": "ID must be a positive number",
});

const paginationQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
}).unknown(false);

exports.createPostSchema = {
  body: Joi.object({
    content: Joi.string().trim().min(2).required(),
  }).unknown(false),
  params: Joi.object({}),
  query: Joi.object({}),
};

exports.updatePostSchema = {
  params: Joi.object({
    postId: id,
  }).unknown(false),
  body: Joi.object({
    content: Joi.string().trim().min(2),
  }).unknown(false),
  query: Joi.object({}),
};

exports.getAllPostsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    userId: Joi.number().integer().positive(),
  }).unknown(false),
};

exports.postIdParamSchema = {
  params: Joi.object({
    postId: id,
  }).unknown(false),
  query: Joi.object({}),
};

exports.likePostSchema = {
  params: Joi.object({
    postId: id,
  }).unknown(false),
  body: Joi.object({}),
  query: Joi.object({}),
};

exports.getAllCommentsOfPostSchema = {
  params: Joi.object({
    postId: id,
  }).unknown(false),
  query: paginationQuery,
};

exports.getCommentOfPostSchema = {
  params: Joi.object({
    postId: id,
    commentId: id,
  }).unknown(false),
  query: Joi.object({}),
};
