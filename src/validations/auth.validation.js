import { fieldError } from './query.validation.js'

// Mirrors avengers-ui `utils/validation.js`, so both sides agree on what a
// valid form is and the API message can be shown next to the right field.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX_LENGTH = 254
const DISPLAY_NAME_MIN_LENGTH = 2
const DISPLAY_NAME_MAX_LENGTH = 32
export const PASSWORD_MIN_LENGTH = 8
// scrypt hashes any length, but an unbounded input is a cheap way to burn CPU.
const PASSWORD_MAX_LENGTH = 128
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/
// Every rule must match. "Special" is anything that is not an ASCII letter, a
// digit or whitespace.
const PASSWORD_RULES = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9\s]/]

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseEmail(value) {
  const email = asTrimmedString(value).toLowerCase()

  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) {
    throw fieldError('email', 'Please enter a valid email address.')
  }

  return email
}

/** Checks the strength rules; reused by `npm run create-admin`. */
export function parseNewPassword(value, field = 'password') {
  const password = typeof value === 'string' ? value : ''

  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw fieldError(
      field,
      `Password must contain between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`,
    )
  }

  if (!PASSWORD_RULES.every((rule) => rule.test(password))) {
    throw fieldError(
      field,
      'Password must contain a lowercase letter, an uppercase letter, a number and a special character.',
    )
  }

  return password
}

// Sign-in does not re-check strength: rules may tighten after an account was
// created, and that must not lock its owner out.
function parseExistingPassword(value) {
  if (
    typeof value !== 'string' ||
    value === '' ||
    value.length > PASSWORD_MAX_LENGTH
  ) {
    throw fieldError('password', 'Please enter your password.')
  }

  return value
}

export function parseDisplayName(value) {
  const displayName = asTrimmedString(value)

  if (
    displayName.length < DISPLAY_NAME_MIN_LENGTH ||
    displayName.length > DISPLAY_NAME_MAX_LENGTH
  ) {
    throw fieldError(
      'displayName',
      `Display name must contain between ${DISPLAY_NAME_MIN_LENGTH} and ${DISPLAY_NAME_MAX_LENGTH} characters.`,
    )
  }

  return displayName
}

function parseToken(value) {
  if (typeof value !== 'string' || !TOKEN_PATTERN.test(value)) {
    throw fieldError('token', 'The link is invalid or has expired.')
  }

  return value
}

export function validateRegisterBody(body = {}) {
  return {
    displayName: parseDisplayName(body.displayName),
    email: parseEmail(body.email),
    password: parseNewPassword(body.password),
  }
}

export function validateLoginBody(body = {}) {
  return {
    email: parseEmail(body.email),
    password: parseExistingPassword(body.password),
    remember: body.remember === true,
  }
}

export function validateEmailBody(body = {}) {
  return { email: parseEmail(body.email) }
}

export function validateTokenBody(body = {}) {
  return { token: parseToken(body.token) }
}

export function validateResetPasswordBody(body = {}) {
  return {
    token: parseToken(body.token),
    password: parseNewPassword(body.password),
  }
}

export { parseEmail }
