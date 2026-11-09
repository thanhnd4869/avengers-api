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

export const PAYMENT_STATUS = Object.freeze({
  // Sent to VNPay, no result yet.
  PENDING: 'pending',
  // Paid, and the order it belongs to was confirmed by it.
  SUCCEEDED: 'succeeded',
  // VNPay reported the payment did not go through.
  FAILED: 'failed',
  // Money was taken but no keys could be delivered for it (the order was
  // already paid by another payment, or its keys were gone). Refunded by
  // hand from the admin.
  REFUND_REQUIRED: 'refund_required',
})

export const PAYMENT_REFUND_STATUS = Object.freeze({
  NONE: 'none',
  PROCESSING: 'processing',
  FAILED: 'failed',
  UNKNOWN: 'unknown',
  SUCCEEDED: 'succeeded',
})

export const PAYMENT_PROVIDER = Object.freeze({ VNPAY: 'vnpay' })
