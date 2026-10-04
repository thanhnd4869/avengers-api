import { ERROR_CODE } from '@constants/error-code.js'
import { ForbiddenError, UnauthorizedError } from '@errors/app-error.js'

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i

function readBearerToken(request) {
  return BEARER_PATTERN.exec(request.get('authorization') ?? '')?.[1]
}

/**
 * `resolveAccessToken(token)` is injected by the composition root; it must
 * resolve to `{ userId, role, sessionId, emailVerified }` or throw 401. The
 * result is stored on `request.auth`.
 */
export function createAuthMiddlewares({ resolveAccessToken }) {
  return {
    async authenticate(request, _response, next) {
      const token = readBearerToken(request)

      if (!token) {
        throw new UnauthorizedError()
      }

      request.auth = await resolveAccessToken(token)
      next()
    },

    /** Like `authenticate`, but lets anonymous visitors through. */
    async optionalAuth(request, _response, next) {
      const token = readBearerToken(request)

      request.auth = token ? await resolveAccessToken(token) : null
      next()
    },

    /** Must run after `authenticate`. */
    authorize(...roles) {
      return (request, _response, next) => {
        if (!request.auth) {
          throw new UnauthorizedError()
        }

        if (!roles.includes(request.auth.role)) {
          throw new ForbiddenError()
        }

        next()
      }
    },

    /** Must run after `authenticate`. */
    requireVerifiedEmail(request, _response, next) {
      if (!request.auth) {
        throw new UnauthorizedError()
      }

      if (!request.auth.emailVerified) {
        throw new ForbiddenError('Please verify your email address first.', {
          code: ERROR_CODE.EMAIL_NOT_VERIFIED,
        })
      }

      next()
    },
  }
}
