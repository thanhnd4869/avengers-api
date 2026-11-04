import { randomUUID } from 'node:crypto'
import compression from 'compression'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { pinoHttp } from 'pino-http'
import { ERROR_CODE } from '#constants/error-code.js'
import { HTTP_STATUS } from '#constants/http-status.js'
import { REQUEST_ID_HEADER } from '#constants/api.js'

export function createSecurityMiddleware() {
  return helmet()
}

/**
 * Only the listed origins may call the API from a browser, and they may send
 * the refresh cookie along. With no list, no cross-origin request is allowed:
 * reflecting any origin while credentials are on would let every site on the
 * web spend a signed-in visitor's session.
 */
export function createCorsMiddleware({ corsOrigins }) {
  return cors({
    origin: corsOrigins.length === 0 ? false : [...corsOrigins],
    credentials: true,
  })
}

export function createCompressionMiddleware() {
  return compression()
}

export function createRequestLoggerMiddleware({ logger }) {
  return pinoHttp({
    logger,
    genReqId(request, response) {
      const existing = request.headers[REQUEST_ID_HEADER]
      const id =
        typeof existing === 'string' && existing !== ''
          ? existing
          : randomUUID()

      response.setHeader(REQUEST_ID_HEADER, id)

      return id
    },
    serializers: {
      // Payment callbacks carry the gateway's signature in the query string;
      // logs keep which payment it was, not its signature.
      req(request) {
        if (typeof request.url === 'string' && request.url.includes('vnp_')) {
          const [path, query = ''] = request.url.split('?')
          const params = new URLSearchParams(query)

          params.delete('vnp_SecureHash')
          request.url = `${path}?${params}`
          request.query = Object.fromEntries(params)
        }

        return request
      },
    },
  })
}

// A frontend dev server fetches every home section on each reload (and React
// StrictMode doubles that), so the production budget runs out within a few
// minutes of normal work. Development keeps the limiter in place, so its
// headers and 429 path still behave the same, but with far more headroom.
const RATE_LIMIT = Object.freeze({ production: 300, development: 10_000 })

/**
 * Counters live in Redis, shared by every API process and kept across
 * restarts, so a budget means the same thing however many instances run.
 * `createStore(name)` is supplied by the composition root.
 *
 * `passOnStoreError` decides what happens while Redis is unreachable: the
 * general limiter lets traffic through so the shop stays browsable, while the
 * sign-in and email limiters refuse, since an unguarded login is the one
 * thing the limit exists to prevent.
 */
function createLimiter({ name, windowMs, limit, createStore, failOpen }) {
  return rateLimit({
    windowMs,
    limit,
    store: createStore(name),
    passOnStoreError: failOpen,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: {
        code: ERROR_CODE.RATE_LIMITED,
        message: 'Too many requests; please try again later',
      },
    },
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  })
}

export function createRateLimitMiddleware({ isProduction, createStore }) {
  return createLimiter({
    name: 'global',
    windowMs: 15 * 60 * 1000,
    limit: isProduction ? RATE_LIMIT.production : RATE_LIMIT.development,
    createStore,
    failOpen: true,
  })
}

const MINUTE = 60 * 1000

/**
 * Tighter per-IP budgets for routes that guess passwords or send email, on
 * top of the global limiter. Development multiplies them so that working on
 * the sign-in form does not lock the developer out.
 */
export function createAuthRateLimits({ isProduction, createStore }) {
  const scale = isProduction ? 1 : 20
  const limiter = (name, windowMs, limit) =>
    createLimiter({ name, windowMs, limit, createStore, failOpen: false })

  return {
    login: limiter('login', 15 * MINUTE, 10 * scale),
    register: limiter('register', 60 * MINUTE, 5 * scale),
    email: limiter('email', 60 * MINUTE, 5 * scale),
    // Each attempt opens a transaction at the gateway.
    payment: limiter('payment', 15 * MINUTE, 10 * scale),
    review: limiter('review', 60 * MINUTE, 20 * scale),
    comment: limiter('comment', 15 * MINUTE, 20 * scale),
  }
}
