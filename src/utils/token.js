import { createHash, randomBytes } from 'node:crypto'

/**
 * An unguessable value for links and cookies. 32 bytes is far beyond brute
 * force, so a plain SHA-256 (no salt, no slow hash) is enough to store it.
 */
export function generateToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}
