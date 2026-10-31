import {
  fieldError,
  parseBoundedInteger,
  parseEnum,
  parseOptionalEnum,
  parseOptionalSlug,
  parsePagination,
} from './query.validation.js'

const SORTS = [
  '-sales',
  '-rating',
  '-releaseDate',
  'releaseDate',
  '-discount',
  'price',
  '-price',
]
const SEARCH_MAX_LENGTH = 100
const PRICE_MAX = 100000

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

function parseOptionalPrice(value, field) {
  if (value === undefined || value === '') {
    return undefined
  }

  const parsed = typeof value === 'string' ? Number(value) : NaN

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > PRICE_MAX) {
    throw fieldError(field, `${field} must be a number from 0 to ${PRICE_MAX}.`)
  }

  return parsed
}

/**
 * Curated rows on the storefront. Each one implies the order that suits it,
 * so `sort` only needs to be sent to override that order.
 */
const COLLECTION_SORTS = {
  deals: '-discount',
  'new-releases': '-releaseDate',
  'pre-orders': 'releaseDate',
}

export function validateProductListQuery(query) {
  const collection = parseOptionalEnum(query.collection, {
    field: 'collection',
    allowed: Object.keys(COLLECTION_SORTS),
  })

  const minPrice = parseOptionalPrice(query.minPrice, 'minPrice')
  const maxPrice = parseOptionalPrice(query.maxPrice, 'maxPrice')

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw fieldError('maxPrice', 'maxPrice must not be below minPrice.')
  }

  return {
    ...parsePagination(query, { defaultLimit: 10 }),
    collection,
    sort: parseEnum(query.sort, {
      field: 'sort',
      fallback: COLLECTION_SORTS[collection] ?? '-sales',
      allowed: SORTS,
    }),
    platformSlug: parseOptionalSlug(query.platform, { field: 'platform' }),
    categorySlug: parseOptionalSlug(query.category, { field: 'category' }),
    search: parseOptionalSearch(query.q),
    minPrice,
    maxPrice,
  }
}

export function validateRelatedProductsQuery(query) {
  return {
    limit: parseBoundedInteger(query.limit, {
      field: 'limit',
      fallback: 4,
      maximum: 12,
    }),
  }
}

export function validateProductReviewsQuery(query) {
  return parsePagination(query, { defaultLimit: 10, maximumLimit: 50 })
}
