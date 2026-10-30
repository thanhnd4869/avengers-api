import { SignJWT, jwtVerify } from 'jose'

const ALGORITHM = 'HS256'
const AUDIENCE = 'oauth-flow'
export const OAUTH_FLOW_TTL_SECONDS = 10 * 60

/**
 * Signs the details of a sign-in started with Google or Facebook (why, where
 * to return, the PKCE verifier). The result is kept in an httpOnly cookie, so
 * the callback only completes in the browser that started the flow, and the
 * `state` sent to the provider is a random value checked against it.
 *
 * The key is derived from the JWT secret with a label, and the audience is
 * checked, so an access token can never pass as a flow token or vice versa.
 */
export function createOAuthFlowSigner({ secret }) {
  const key = new TextEncoder().encode(`${secret}:${AUDIENCE}`)

  return {
    sign(flow) {
      return new SignJWT({ flow })
        .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${OAUTH_FLOW_TTL_SECONDS}s`)
        .sign(key)
    },

    /** The flow, or `null` for a missing, expired or tampered token. */
    async verify(token) {
      if (typeof token !== 'string' || token === '') return null

      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ALGORITHM],
          audience: AUDIENCE,
        })

        return payload.flow && typeof payload.flow === 'object'
          ? payload.flow
          : null
      } catch {
        return null
      }
    },
  }
}
