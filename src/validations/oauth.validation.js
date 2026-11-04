import { OAUTH_INTENT, OAUTH_PROVIDER } from '#constants/auth.js'
import { fieldError } from './query.validation.js'

const PROVIDERS = Object.values(OAUTH_PROVIDER)
const INTENTS = Object.values(OAUTH_INTENT)
const REDIRECT_MAX_LENGTH = 512

export function parseProvider(value) {
  if (!PROVIDERS.includes(value)) {
    throw fieldError('provider', 'Unknown sign-in provider.')
  }

  return value
}

/**
 * A path on the shop only, so a crafted link cannot bounce the visitor to
 * another site after signing in. Mirrors `safeRedirect` in avengers-shop.
 */
export function parseRedirect(value, fallback) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    value.length <= REDIRECT_MAX_LENGTH
    ? value
    : fallback
}

export function validateOAuthStartBody(body = {}) {
  const intent = body.intent ?? OAUTH_INTENT.LOGIN

  if (!INTENTS.includes(intent)) {
    throw fieldError('intent', 'Unknown sign-in intent.')
  }

  return {
    intent,
    remember: body.remember === true,
    redirect: parseRedirect(body.redirect, null),
  }
}
