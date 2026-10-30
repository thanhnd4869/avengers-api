export const USER_ROLE = Object.freeze({ USER: 'user', ADMIN: 'admin' })

export const USER_TOKEN_TYPE = Object.freeze({
  VERIFY_EMAIL: 'verify_email',
  RESET_PASSWORD: 'reset_password',
  CHANGE_EMAIL: 'change_email',
})

// Path-scoped so the browser sends it to /auth/refresh and /auth/logout only,
// never along with ordinary API calls.
export const REFRESH_COOKIE_NAME = 'refresh_token'
