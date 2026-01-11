/**
 * Pagination Utility
 *
 * Provides helper functions for implementing cursor-based and offset-based pagination
 */

/**
 * Parse pagination parameters from request query
 *
 * @param {Object} query - Express req.query object
 * @param {Object} options - Default options
 * @returns {Object} Parsed pagination parameters
 */
export function parsePaginationParams(query, options = {}) {
  const {
    defaultPage = 1,
    defaultLimit = 20,
    maxLimit = 100,
  } = options;

  let page = parseInt(query.page) || defaultPage;
  let limit = parseInt(query.limit) || defaultLimit;

  // Validate and constrain values
  page = Math.max(1, page);
  limit = Math.min(Math.max(1, limit), maxLimit);

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
  };
}

/**
 * Build pagination metadata for response
 *
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Pagination metadata
 */
export function buildPaginationMeta(page, limit, total) {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
    hasPrevious: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    previousPage: page > 1 ? page - 1 : null,
  };
}

/**
 * Helper to add pagination to SQL query
 *
 * @param {string} baseQuery - Base SQL query without LIMIT/OFFSET
 * @param {Object} pagination - Pagination params from parsePaginationParams
 * @param {Array} params - Array of query parameters
 * @returns {Object} Query string and updated params
 */
export function paginateQuery(baseQuery, pagination, params = []) {
  const { limit, offset } = pagination;
  const paramCount = params.length;

  const paginatedQuery = `${baseQuery} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  const paginatedParams = [...params, limit, offset];

  return {
    query: paginatedQuery,
    params: paginatedParams,
  };
}

/**
 * Cursor-based pagination encoder/decoder
 * Useful for infinite scroll and large datasets
 */
export const CursorPagination = {
  /**
   * Encode a cursor value (base64)
   */
  encode(value) {
    return Buffer.from(String(value)).toString('base64');
  },

  /**
   * Decode a cursor value
   */
  decode(cursor) {
    try {
      return Buffer.from(cursor, 'base64').toString('utf-8');
    } catch (err) {
      throw new Error('Invalid cursor format');
    }
  },

  /**
   * Build cursor pagination response
   */
  buildResponse(data, cursorField, limit) {
    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;

    const nextCursor = hasMore
      ? this.encode(items[items.length - 1][cursorField])
      : null;

    return {
      data: items,
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  },

  /**
   * Build cursor-based SQL query
   *
   * @param {string} baseQuery - Base query
   * @param {string} cursorField - Field to use for cursor (e.g., 'created_at', 'id')
   * @param {string} cursor - Current cursor value
   * @param {number} limit - Items to fetch
   * @param {string} direction - 'ASC' or 'DESC'
   * @param {Array} params - Existing query parameters
   */
  buildQuery(baseQuery, cursorField, cursor, limit, direction = 'DESC', params = []) {
    let query = baseQuery;
    let queryParams = [...params];

    if (cursor) {
      try {
        const decodedCursor = this.decode(cursor);
        const operator = direction === 'DESC' ? '<' : '>';
        const whereClause = queryParams.length === 0 ? 'WHERE' : 'AND';

        query += ` ${whereClause} ${cursorField} ${operator} $${queryParams.length + 1}`;
        queryParams.push(decodedCursor);
      } catch (err) {
        throw new Error('Invalid cursor');
      }
    }

    // Fetch one extra item to determine if there are more results
    query += ` ORDER BY ${cursorField} ${direction} LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit + 1);

    return {
      query,
      params: queryParams,
    };
  },
};

/**
 * Paginate array in memory (use sparingly, prefer DB-level pagination)
 */
export function paginateArray(array, page, limit) {
  const offset = (page - 1) * limit;
  const paginatedItems = array.slice(offset, offset + limit);

  return {
    data: paginatedItems,
    pagination: buildPaginationMeta(page, limit, array.length),
  };
}

/**
 * Sort parameters parser
 */
export function parseSortParams(query, allowedFields = [], defaultSort = { field: 'created_at', order: 'DESC' }) {
  const sortField = query.sortBy || query.sort_by || defaultSort.field;
  const sortOrder = (query.order || query.sort_order || defaultSort.order).toUpperCase();

  // Validate sort field
  if (allowedFields.length > 0 && !allowedFields.includes(sortField)) {
    return defaultSort;
  }

  // Validate sort order
  if (!['ASC', 'DESC'].includes(sortOrder)) {
    return { field: sortField, order: defaultSort.order };
  }

  return {
    field: sortField,
    order: sortOrder,
  };
}

/**
 * Build SQL ORDER BY clause from sort params
 */
export function buildOrderByClause(sortParams, fieldMapping = {}) {
  const field = fieldMapping[sortParams.field] || sortParams.field;
  return `ORDER BY ${field} ${sortParams.order}`;
}

/**
 * Complete pagination helper that combines multiple utilities
 *
 * @example
 * const { pagination, sort } = preparePagination(req.query, {
 *   allowedSortFields: ['name', 'created_at', 'price']
 * });
 */
export function preparePagination(query, options = {}) {
  const pagination = parsePaginationParams(query, options);
  const sort = parseSortParams(query, options.allowedSortFields, options.defaultSort);

  return {
    pagination,
    sort,
  };
}

export default {
  parsePaginationParams,
  buildPaginationMeta,
  paginateQuery,
  CursorPagination,
  paginateArray,
  parseSortParams,
  buildOrderByClause,
  preparePagination,
};
