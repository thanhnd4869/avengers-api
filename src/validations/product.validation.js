import { parseEnum, parsePagination } from './query.validation.js'

const SORTS = ['-sales', '-rating']

export function validateProductListQuery(query) {
  return {
    ...parsePagination(query, { defaultLimit: 10 }),
    sort: parseEnum(query.sort, {
      field: 'sort',
      fallback: '-sales',
      allowed: SORTS,
    }),
  }
}
