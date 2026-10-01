import {
  fieldError,
  parseEnum,
  parseOptionalSlug,
  parsePagination,
} from './query.validation.js'

const SORTS = ['-publishedAt']
const SEARCH_MAX_LENGTH = 100

function parseOptionalSearch(value) {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string' || value.trim().length > SEARCH_MAX_LENGTH) {
    throw fieldError(
      'q',
      `q must be text of at most ${SEARCH_MAX_LENGTH} characters.`,
    )
  }

  return value.trim() || undefined
}

export function validatePostListQuery(query) {
  return {
    ...parsePagination(query, { defaultLimit: 10 }),
    sort: parseEnum(query.sort, {
      field: 'sort',
      fallback: '-publishedAt',
      allowed: SORTS,
    }),
    categorySlug: parseOptionalSlug(query.category, { field: 'category' }),
    search: parseOptionalSearch(query.q),
  }
}
