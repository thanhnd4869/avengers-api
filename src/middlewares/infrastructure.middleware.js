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

export function createRateLimitMiddleware() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      code: ERROR_CODE.TOO_MANY_REQUESTS,
      message: 'Too many requests; please try again later',
    },
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  })
}
