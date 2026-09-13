import { ValidationError } from '@errors/app-error.js'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function fieldError(field, message) {
  return new ValidationError(message, { details: [{ field, message }] })
}

export function parseBoundedInteger(
  value,
  { field, fallback, minimum = 1, maximum },
) {
  const parsed = value === undefined ? fallback : Number(value)

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw fieldError(
      field,
      `${field} must be an integer from ${minimum} to ${maximum}.`,
    )
  }

  return parsed
}

export function parseEnum(value, { field, fallback, allowed }) {
  const parsed = value ?? fallback

  if (!allowed.includes(parsed)) {
    throw fieldError(field, `${field} must be one of: ${allowed.join(', ')}.`)
  }

  return parsed
}

export function parseOptionalSlug(value, { field }) {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string' || !SLUG_PATTERN.test(value)) {
    throw fieldError(field, `${field} must be a URL-safe slug.`)
  }

  return value
}

export function parsePagination(query, { defaultLimit, maximumLimit = 100 }) {
  return {
    page: parseBoundedInteger(query.page, {
      field: 'page',
      fallback: 1,
      maximum: 10000,
    }),
    limit: parseBoundedInteger(query.limit, {
      field: 'limit',
      fallback: defaultLimit,
      maximum: maximumLimit,
    }),
  }
}
