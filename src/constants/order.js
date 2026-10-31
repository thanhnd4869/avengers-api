export const ORDER_STATUS = Object.freeze({
  // Keys are held for the shopper while they pay.
  PENDING: 'pending',
  PAID: 'paid',
  // Not paid in time.
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
})

export const KEY_STATUS = Object.freeze({
  AVAILABLE: 'available',
  // Held by a pending (or just expired) order.
  RESERVED: 'reserved',
  SOLD: 'sold',
})

export const ORDER_CURRENCY = 'VND'
