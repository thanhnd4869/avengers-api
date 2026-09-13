import { parseBoundedInteger } from './query.validation.js'

export function validateBannerListQuery(query) {
  return {
    limit: parseBoundedInteger(query.limit, {
      field: 'limit',
      fallback: 10,
      maximum: 20,
    }),
  }
}
