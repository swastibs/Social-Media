const Activity = require("../models/activity.model");
const { successResponse } = require("../utils/ApiResponse");
const { setCache } = require("../utils/cache");

exports.getActivities = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      userId,
      method,
      route,
      status,
      entity,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (userId) query.userId = Number(userId);
    if (method) query.method = method;
    if (route) query.route = { $regex: route, $options: "i" };
    if (status) query.responseStatus = Number(status);
    if (entity) query.entity = entity;

    if (startDate || endDate) {
      query.requestTime = {};
      if (startDate) query.requestTime.$gte = new Date(startDate);
      if (endDate) query.requestTime.$lte = new Date(endDate);
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    const totalRecords = await Activity.countDocuments(query);

    const totalPages = Math.max(Math.ceil(totalRecords / limitNum), 1);

    const safePage = Math.min(pageNum, totalPages);

    const skip = (safePage - 1) * limitNum;

    const data = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const result = {
      message: "Logs fetched successfully",
      data,
      meta: {
        totalRecords,
        currentPage: safePage,
        totalPages,
        limit: limitNum,
      },
    };

    if (req.cacheKey) await setCache(req.cacheKey, result);

    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
};
