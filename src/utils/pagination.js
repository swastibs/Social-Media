/**
 * Pagination Utility
 *
 * Provides a reusable pagination function for Sequelize models.
 * Standardizes pagination logic across all controllers.
 */

/**
 * Paginates Sequelize queries with consistent response format.
 * @param {Object} params - Pagination parameters
 * @param {Model} params.model - Sequelize model to query
 * @param {Object} params.where - Sequelize WHERE conditions
 * @param {number} params.page - Current page number (default: 1)
 * @param {number} params.limit - Items per page (default: 10, max: 50)
 * @param {Array} params.include - Associated models to include
 * @param {Array} params.order - Sort order (e.g., [['createdAt', 'DESC']])
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
exports.paginate = async ({
  model,
  where = {},
  page = 1,
  limit = 10,
  include = [],
  order = [["createdAt", "DESC"]],
}) => {
  // Validate and sanitize inputs
  page = parseInt(page, 10) || 1;
  limit = Math.min(parseInt(limit, 10) || 10, 50);

  // Get total record count (with distinct to handle includes)
  const { count } = await model.findAndCountAll({
    where,
    include,
    distinct: true,
  });

  const totalRecords = count;
  const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

  // Ensure page is within valid range
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const offset = (safePage - 1) * limit;

  // Fetch paginated data
  const { rows } = await model.findAndCountAll({
    where,
    include,
    distinct: true,
    subQuery: false, // Avoid performance issues with complex includes
    limit,
    offset,
    order,
  });

  return {
    data: rows,
    pagination: {
      totalRecords,
      totalPages,
      currentPage: safePage,
      limit,
    },
  };
};
