import { fieldError } from './query.validation.js'

export const CART_MAX_QUANTITY = 10
export const CART_MAX_LINES = 50

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i

export function parseVariantId(value, field = 'variantId') {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    throw fieldError(field, `${field} must be a variant id.`)
  }

  return value.toLowerCase()
}

function parseQuantity(value, field = 'quantity') {
  if (!Number.isInteger(value) || value < 1 || value > CART_MAX_QUANTITY) {
    throw fieldError(
      field,
      `${field} must be an integer from 1 to ${CART_MAX_QUANTITY}.`,
    )
  }

  return value
}

export function validateAddItemBody(body = {}) {
  return {
    variantId: parseVariantId(body.variantId),
    quantity: body.quantity === undefined ? 1 : parseQuantity(body.quantity),
  }
}

export function validateQuantityBody(body = {}) {
  return { quantity: parseQuantity(body.quantity) }
}

/**
 * A guest cart sent from the browser, to be priced or merged. Repeated
 * variants are combined, as they would be in a stored cart.
 */
export function validateItemsBody(body = {}) {
  if (!Array.isArray(body.items) || body.items.length > CART_MAX_LINES) {
    throw fieldError(
      'items',
      `items must be a list of at most ${CART_MAX_LINES} lines.`,
    )
  }

  const quantities = new Map()

  body.items.forEach((item, index) => {
    const variantId = parseVariantId(
      item?.variantId,
      `items[${index}].variantId`,
    )
    const quantity = parseQuantity(item?.quantity, `items[${index}].quantity`)

    quantities.set(
      variantId,
      Math.min((quantities.get(variantId) ?? 0) + quantity, CART_MAX_QUANTITY),
    )
  })

  return {
    items: [...quantities].map(([variantId, quantity]) => ({
      variantId,
      quantity,
    })),
  }
}
