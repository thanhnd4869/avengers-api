import {
  parseEnum,
  parseOptionalEnum,
  parseOptionalSlug,
  parsePagination,
} from './query.validation.js'

const SORTS = ['-sales', '-rating', '-releaseDate', 'releaseDate', '-discount']

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

  return {
    ...parsePagination(query, { defaultLimit: 10 }),
    collection,
    sort: parseEnum(query.sort, {
      field: 'sort',
      fallback: COLLECTION_SORTS[collection] ?? '-sales',
      allowed: SORTS,
    }),
    platformSlug: parseOptionalSlug(query.platform, { field: 'platform' }),
  }
}
