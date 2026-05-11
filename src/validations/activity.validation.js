const { Joi } = require("express-validation");

const id = Joi.number().integer().positive().messages({
  "number.base": "must be a number",
  "number.integer": "must be an integer",
  "number.positive": "must be positive",
});

const pagination = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
});

exports.getActivitiesSchema = {
  query: Joi.object({
    page: pagination.extract("page"),
    limit: pagination.extract("limit"),

    userId: id.optional(),
    status: Joi.number().integer().optional(),
    method: Joi.string()
      .valid("GET", "POST", "PUT", "PATCH", "DELETE")
      .optional(),

    route: Joi.string().optional(),
    entity: Joi.string().optional(),

    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }).unknown(false),
};
