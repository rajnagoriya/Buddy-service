/** @typedef {{ page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean }} PaginationMeta */

export const EMPTY_PAGINATION = Object.freeze({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
});

/**
 * Normalize pagination metadata from any supported API shape.
 * @param {unknown} source
 * @returns {PaginationMeta}
 */
export function normalizePagination(source) {
  if (!source || typeof source !== "object") {
    return { ...EMPTY_PAGINATION };
  }

  const raw = /** @type {Record<string, unknown>} */ (source);
  const total = Number(raw.total ?? raw.totalCount ?? raw.totalItems ?? 0);
  const limit = Math.max(1, Number(raw.limit) || 20);
  const page = Math.max(1, Number(raw.page) || 1);
  const totalPages =
    Number(raw.totalPages ?? raw.pages) ||
    (total > 0 ? Math.max(1, Math.ceil(total / limit)) : 0);

  const hasNextPage =
    typeof raw.hasNextPage === "boolean"
      ? raw.hasNextPage
      : typeof raw.hasMore === "boolean"
        ? raw.hasMore
        : totalPages > 0 && page < totalPages;

  const hasPreviousPage =
    typeof raw.hasPreviousPage === "boolean"
      ? raw.hasPreviousPage
      : typeof raw.hasPrevPage === "boolean"
        ? raw.hasPrevPage
        : page > 1;

  return {
    page,
    limit,
    total: Number.isFinite(total) ? total : 0,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  };
}

/**
 * Extract pagination from common response payload shapes.
 * @param {unknown} payload
 * @returns {PaginationMeta}
 */
export function extractPagination(payload) {
  if (!payload || typeof payload !== "object") {
    return { ...EMPTY_PAGINATION };
  }

  const data = /** @type {Record<string, unknown>} */ (payload);

  if (data.pagination && typeof data.pagination === "object") {
    return normalizePagination(data.pagination);
  }

  if (
    data.restaurants &&
    (data.total != null || data.page != null || data.limit != null)
  ) {
    return normalizePagination({
      page: data.page,
      limit: data.limit,
      total: data.total,
    });
  }

  if (data.meta && typeof data.meta === "object") {
    return normalizePagination(data.meta);
  }

  if (
    data.page != null ||
    data.limit != null ||
    data.total != null ||
    data.totalPages != null
  ) {
    return normalizePagination(data);
  }

  return { ...EMPTY_PAGINATION };
}

/**
 * Stable key for paginated list queries (page excluded).
 * @param {Record<string, unknown>} params
 */
export function buildPaginatedQueryKey(params = {}) {
  const { page: _page, _ts, ...rest } = params;
  const keys = Object.keys(rest).sort();
  return keys.map((key) => `${key}:${JSON.stringify(rest[key])}`).join("|");
}
