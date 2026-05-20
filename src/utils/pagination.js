exports.paginate = async ({
  model,
  where = {},
  page = 1,
  limit = 10,
  include = [],
  order = [["createdAt", "DESC"]],
}) => {
  page = parseInt(page, 10) || 1;
  limit = Math.min(parseInt(limit, 10) || 10, 50);

  const { count } = await model.findAndCountAll({
    where,
    include,
    distinct: true,
  });

  const totalRecords = count;
  const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

  const safePage = Math.min(Math.max(page, 1), totalPages);

  const offset = (safePage - 1) * limit;

  const { rows } = await model.findAndCountAll({
    where,
    include,
    distinct: true,
    subQuery: false,
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
