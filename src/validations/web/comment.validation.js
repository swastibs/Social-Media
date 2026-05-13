const { Joi } = require("express-validation");

const id = Joi.number().integer().positive().required().messages({
    "number.base": "ID must be a number",
    "number.integer": "ID must be an integer",
    "number.positive": "ID must be a positive number",
});

exports.createCommentSchema = {
    body: Joi.object({
        postId: id,
        content: Joi.string().trim().min(1).required().messages({
            "string.empty": "Comment cannot be empty",
            "any.required": "Comment content is required",
        }),
    }).unknown(false),
};

exports.updateCommentSchema = {
    params: Joi.object({
        commentId: id,
    }).unknown(false),
    body: Joi.object({
        content: Joi.string().trim().min(1).required().messages({
            "string.empty": "Comment cannot be empty",
            "any.required": "Comment content is required",
        }),
    }).unknown(false),
};

exports.commentIdParamSchema = {
    params: Joi.object({
        commentId: id,
    }).unknown(false),
};