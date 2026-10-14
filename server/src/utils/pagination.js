export function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  const offset = (page - 1) * pageSize;
  const search = typeof query.search === 'string' ? query.search.trim() : '';

  return {
    page,
    pageSize,
    limit: pageSize,
    offset,
    search
  };
}

export function formatPaginated(data, total, page, pageSize) {
  return {
    data,
    page,
    pageSize,
    total: Number(total)
  };
}
