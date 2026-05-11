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

exports.createCommentSchema = {
  body: Joi.object({
    postId: id,
    content: Joi.string().trim().min(1).required(),
  }).unknown(false),
  params: Joi.object({}),
  query: Joi.object({}),
};

exports.updateCommentSchema = {
  params: Joi.object({
    commentId: id,
  }).unknown(false),
  body: Joi.object({
    content: Joi.string().trim().min(1),
  })
    .min(1)
    .unknown(false),
  query: Joi.object({}),
};

exports.getAllCommentsSchema = {
  query: paginationQuery,
  params: Joi.object({}),
};

exports.commentIdParamSchema = {
  params: Joi.object({
    commentId: id,
  }).unknown(false),
  query: Joi.object({}),
};
