import {
  parseEnum,
  parseOptionalSlug,
  parsePagination,
} from './query.validation.js'

const SORTS = ['-publishedAt']

export function validatePostListQuery(query) {
  return {
    ...parsePagination(query, { defaultLimit: 10 }),
    sort: parseEnum(query.sort, {
      field: 'sort',
      fallback: '-publishedAt',
      allowed: SORTS,
    }),
    categorySlug: parseOptionalSlug(query.category, { field: 'category' }),
  }
}
