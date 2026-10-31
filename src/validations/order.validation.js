import { fieldError, parsePagination } from './query.validation.js'

// A UUID from the browser, or anything similarly unguessable.
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/
const ORDER_NUMBER_PATTERN = /^AV-\d{6}-[0-9A-Z]{6}$/

export function validateCreateOrderBody(body = {}) {
  if (
    typeof body.idempotencyKey !== 'string' ||
    !IDEMPOTENCY_KEY_PATTERN.test(body.idempotencyKey)
  ) {
    throw fieldError(
      'idempotencyKey',
      'idempotencyKey must be 16 to 64 letters, digits, - or _.',
    )
  }

  if (!Number.isInteger(body.expectedTotal) || body.expectedTotal < 0) {
    throw fieldError(
      'expectedTotal',
      'expectedTotal must be the whole total shown in the cart.',
    )
  }

  return {
    idempotencyKey: body.idempotencyKey,
    expectedTotal: body.expectedTotal,
  }
}

/** Answers `null` for anything that cannot be an order number. */
export function parseOrderNumber(value) {
  return typeof value === 'string' && ORDER_NUMBER_PATTERN.test(value)
    ? value
    : null
}

export function validateOrderListQuery(query) {
  return parsePagination(query, { defaultLimit: 10, maximumLimit: 50 })
}
