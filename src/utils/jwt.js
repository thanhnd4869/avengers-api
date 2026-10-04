import { SignJWT, jwtVerify } from 'jose'

const ALGORITHM = 'HS256'

/**
 * Signs and verifies short-lived access tokens. The secret is passed in by
 * the composition root, so no other module ever reads it from the environment.
 */
export function createAccessTokenSigner({ secret, ttlMinutes }) {
  const key = new TextEncoder().encode(secret)

  return {
    ttlSeconds: ttlMinutes * 60,

    sign({ userId, role, sessionId }) {
      return new SignJWT({ role, sid: sessionId })
        .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${ttlMinutes}m`)
        .sign(key)
    },

    /**
     * Resolves to `{ userId, role, sessionId }`, or `null` for any token that
     * is malformed, expired, forged or signed with another algorithm.
     */
    async verify(token) {
      try {
        // Pinning the algorithm rejects `alg: none` and key-confusion tricks.
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ALGORITHM],
        })

        if (
          typeof payload.sub !== 'string' ||
          typeof payload.sid !== 'string'
        ) {
          return null
        }

        return {
          userId: payload.sub,
          role: payload.role,
          sessionId: payload.sid,
        }
      } catch {
        return null
      }
    },
  }
}
