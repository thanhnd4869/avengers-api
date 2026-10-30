export const USER_ROLE = Object.freeze({ USER: 'user', ADMIN: 'admin' })

export const USER_TOKEN_TYPE = Object.freeze({
  VERIFY_EMAIL: 'verify_email',
  RESET_PASSWORD: 'reset_password',
  CHANGE_EMAIL: 'change_email',
})

// Carries the details of a Google or Facebook sign-in between its start and
// the provider's callback. Path-scoped like the refresh cookie.
export const OAUTH_FLOW_COOKIE_NAME = 'oauth_flow'

export const OAUTH_PROVIDER = Object.freeze({
  GOOGLE: 'google',
  FACEBOOK: 'facebook',
})

// Why the visitor was sent to the provider; carried in the signed `state`.
export const OAUTH_INTENT = Object.freeze({
  // Sign in or sign up.
  LOGIN: 'login',
  // Attach the provider to the signed-in account.
  LINK: 'link',
  // Prove it is still the owner before a sensitive change, for an account
  // that has no password to type.
  REAUTH: 'reauth',
})

// Path-scoped so the browser sends it to /auth/refresh and /auth/logout only,
// never along with ordinary API calls.
export const REFRESH_COOKIE_NAME = 'refresh_token'
