// Clients must branch on these rather than on messages, which are free to
// change and will eventually be translated.
export const ERROR_CODE = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  // The access token was valid, but its session was ended elsewhere, usually
  // by a sign-in on another device.
  SESSION_REVOKED: 'SESSION_REVOKED',
  // The session was signed out or expired; signing in again is enough.
  SESSION_ENDED: 'SESSION_ENDED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  FORBIDDEN: 'FORBIDDEN',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_ALREADY_VERIFIED: 'EMAIL_ALREADY_VERIFIED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  // The account has no address yet (a Facebook sign-up that shared none).
  NO_EMAIL: 'NO_EMAIL',
  // An account without a password must confirm with Google or Facebook
  // before a sensitive change.
  REAUTH_REQUIRED: 'REAUTH_REQUIRED',
  // Removing this would leave the account with no way to sign in.
  LAST_SIGN_IN_METHOD: 'LAST_SIGN_IN_METHOD',
  NOT_FOUND: 'NOT_FOUND',
  // The variant exists but has no keys left to sell.
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  // More than a cart line or a cart may hold.
  CART_LIMIT: 'CART_LIMIT',
  CART_EMPTY: 'CART_EMPTY',
  // Something in the cart cannot be bought as it is (sold out, too many).
  CART_NOT_READY: 'CART_NOT_READY',
  // The total differs from what the shopper saw; the cart must be reviewed.
  PRICE_CHANGED: 'PRICE_CHANGED',
  // The shopper already has an unpaid order; pay or cancel it first.
  PENDING_ORDER_EXISTS: 'PENDING_ORDER_EXISTS',
  // The order is no longer pending, so it cannot be cancelled or paid.
  ORDER_NOT_PENDING: 'ORDER_NOT_PENDING',
  // Too little of the hold is left to finish paying at the gateway.
  PAYMENT_WINDOW_CLOSED: 'PAYMENT_WINDOW_CLOSED',
  // No payment gateway is configured.
  PAYMENT_UNAVAILABLE: 'PAYMENT_UNAVAILABLE',
  // The gateway's reply could not be trusted (bad signature, wrong order).
  INVALID_PAYMENT_RESULT: 'INVALID_PAYMENT_RESULT',
  // Only shoppers who paid for a game may review it.
  REVIEW_NOT_ALLOWED: 'REVIEW_NOT_ALLOWED',
  // The shopper already reviewed this game; they may edit that review.
  REVIEW_EXISTS: 'REVIEW_EXISTS',
  // Another product already uses this slug.
  SLUG_TAKEN: 'SLUG_TAKEN',
  // The product is already sold on this platform in this edition.
  VARIANT_EXISTS: 'VARIANT_EXISTS',
  // A variant that ever had a key stays, so its orders keep their history.
  VARIANT_HAS_KEYS: 'VARIANT_HAS_KEYS',
  // Some of the submitted codes are already in stock.
  DUPLICATE_KEYS: 'DUPLICATE_KEYS',
  // The payment is not owed back, or was already refunded.
  REFUND_NOT_OWED: 'REFUND_NOT_OWED',
  REFUND_REJECTED: 'REFUND_REJECTED',
  REFUND_RESULT_UNKNOWN: 'REFUND_RESULT_UNKNOWN',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
})
