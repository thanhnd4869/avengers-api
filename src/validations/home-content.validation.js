import { ValidationError } from '@errors/app-error.js'

function validationError(field, message) {
  return new ValidationError(message, {
    details: [{ field, message }],
  })
}

function positiveInteger(value, fallback, field, maximum = 100) {
  const parsed = value === undefined ? fallback : Number(value)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw validationError(
      field,
      `${field} must be an integer from 1 to ${maximum}.`,
    )
  }

  return parsed
}

export function validateBannerQuery(query) {
  return { limit: positiveInteger(query.limit, 10, 'limit', 20) }
}

export function validateProductQuery(query) {
  const sort = query.sort ?? '-sales'
  if (!['-sales', '-rating'].includes(sort)) {
    throw validationError('sort', 'sort must be -sales or -rating.')
  }

  return {
    page: positiveInteger(query.page, 1, 'page'),
    limit: positiveInteger(query.limit, 10, 'limit', 100),
    sort,
  }
}

export function validatePostQuery(query) {
  const sort = query.sort ?? '-publishedAt'
  if (sort !== '-publishedAt') {
    throw validationError('sort', 'sort must be -publishedAt.')
  }

  if (
    query.category !== undefined &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(query.category)
  ) {
    throw validationError('category', 'category must be a URL-safe slug.')
  }

  return {
    page: positiveInteger(query.page, 1, 'page'),
    limit: positiveInteger(query.limit, 10, 'limit', 100),
    category: query.category,
  }
}

export function validateContactBody(body) {
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw validationError('email', 'Please enter a valid email address.')
  }

  if (message.length < 10 || message.length > 2000) {
    throw validationError(
      'message',
      'Message must contain between 10 and 2000 characters.',
    )
  }

  return { email, message }
}
