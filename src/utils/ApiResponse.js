exports.successResponse = (res, options = {}) => {
  const {
    statusCode = 200,
    message = "Success",
    data = null,
    ...extra
  } = options;

  if (typeof statusCode !== "number") {
    throw new Error("statusCode must be a number");
  }

  const response = {
    success: true,
    message,
    ...extra,
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};
