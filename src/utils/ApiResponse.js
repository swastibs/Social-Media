exports.successResponse = (res, options = {}) => {
  const {
    statusCode = 200,
    message = "Success",
    data = null,
    ...extra
  } = options;

  const response = {
    success: true,
    message,
    ...extra,
  };

  if (data !== null && data !== undefined) response.data = data;

  return res.status(statusCode).json(response);
};

exports.errorResponse = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    message,
  };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};
