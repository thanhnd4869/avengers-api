export function toPaginatedResponse(data, { page, limit, total }) {
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}
