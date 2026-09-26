import { randomUUID } from 'node:crypto'
import compression from 'compression'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { pinoHttp } from 'pino-http'
import { ERROR_CODE } from '@constants/error-code.js'
import { HTTP_STATUS } from '@constants/http-status.js'
import { REQUEST_ID_HEADER } from '@constants/api.js'

export function createSecurityMiddleware() {
  return helmet()
}

export function createCorsMiddleware({ corsOrigins }) {
  return cors({
    origin: corsOrigins.length === 0 ? true : [...corsOrigins],
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
  })
}

// A frontend dev server fetches every home section on each reload (and React
// StrictMode doubles that), so the production budget runs out within a few
// minutes of normal work. Development keeps the limiter in place, so its
// headers and 429 path still behave the same, but with far more headroom.
const RATE_LIMIT = Object.freeze({ production: 300, development: 10_000 })

export function createRateLimitMiddleware({ isProduction }) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProduction ? RATE_LIMIT.production : RATE_LIMIT.development,
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
