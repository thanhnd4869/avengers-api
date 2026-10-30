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
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
})
