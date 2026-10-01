import { parseBoundedInteger, parseOptionalEnum } from './query.validation.js'

const TYPES = ['screenshot', 'video']

export function validateMediaListQuery(query) {
  return {
    type: parseOptionalEnum(query.type, { field: 'type', allowed: TYPES }),
    limit: parseBoundedInteger(query.limit, {
      field: 'limit',
      fallback: 12,
      maximum: 50,
    }),
  }
}
