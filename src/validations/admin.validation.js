import { USER_ROLE } from '#constants/auth.js'
import { ORDER_STATUS, PAYMENT_STATUS } from '#constants/order.js'
import {
  fieldError,
  parseEnum,
  parseOptionalEnum,
  parsePagination,
} from './query.validation.js'

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i
const ORDER_NUMBER_PATTERN = /^AV-\d{6}-[0-9A-Z]{6}$/
const SEARCH_MAX_LENGTH = 100

export function parseOptionalSearch(value) {
  if (value === undefined) return undefined

  if (typeof value !== 'string' || value.trim().length > SEARCH_MAX_LENGTH) {
    throw fieldError(
      'q',
      `q must be text of at most ${SEARCH_MAX_LENGTH} characters.`,
    )
  }

  return value.trim() || undefined
}

export function validateObjectId(value, field = 'id') {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    throw fieldError(field, `${field} must be a valid identifier.`)
  }

  return value
}

/** Answers `null` for anything that cannot be an order number. */
export function parseAdminOrderNumber(value) {
  return typeof value === 'string' && ORDER_NUMBER_PATTERN.test(value)
    ? value
    : null
}

export function validateAdminOrderListQuery(query = {}) {
  return {
    ...parsePagination(query, { defaultLimit: 20 }),
    status: parseOptionalEnum(query.status, {
      field: 'status',
      allowed: Object.values(ORDER_STATUS),
    }),
    search: parseOptionalSearch(query.q),
  }
}

export function validateAdminPaymentListQuery(query = {}) {
  return {
    ...parsePagination(query, { defaultLimit: 20 }),
    status: parseOptionalEnum(query.status, {
      field: 'status',
      // `refunded` is not a stored status: refunds paid back by hand.
      allowed: [...Object.values(PAYMENT_STATUS), 'refunded'],
    }),
  }
}

export function validateAdminUserListQuery(query = {}) {
  return {
    ...parsePagination(query, { defaultLimit: 20 }),
    role: parseOptionalEnum(query.role, {
      field: 'role',
      allowed: Object.values(USER_ROLE),
    }),
    search: parseOptionalSearch(query.q),
  }
}

export function validateAdminProductListQuery(query = {}) {
  const published = parseOptionalEnum(query.published, {
    field: 'published',
    allowed: ['true', 'false'],
  })

  return {
    ...parsePagination(query, { defaultLimit: 20 }),
    search: parseOptionalSearch(query.q),
    published: published === undefined ? undefined : published === 'true',
  }
}

export function validateOverviewQuery(query = {}) {
  const days = parseEnum(query.days, {
    field: 'days',
    fallback: '30',
    allowed: ['7', '30', '90'],
  })

  return { days: Number(days) }
}
