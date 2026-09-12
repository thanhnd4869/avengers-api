import express from 'express'
import { API_PREFIX } from './constants/api.js'
import { createErrorHandlerMiddleware } from './middlewares/error-handler.middleware.js'
import {
  createCompressionMiddleware,
  createCorsMiddleware,
  createRateLimitMiddleware,
  createRequestLoggerMiddleware,
  createSecurityMiddleware,
} from './middlewares/infrastructure.middleware.js'
import { notFoundMiddleware } from './middlewares/not-found.middleware.js'

export function createApp({ router, healthRouter, environment, logger }) {
  const app = express()

  app.disable('x-powered-by')

  app.use(createSecurityMiddleware())
  // Runs early so that every later stage, including rejected requests, can be
  // correlated through a single request id.
  app.use(createRequestLoggerMiddleware({ logger }))
  app.use(createCorsMiddleware(environment))

  // Probes are mounted before the rate limiter and outside the versioned
  // prefix: a platform health checker polls a fixed path and must never be
  // throttled into a false negative.
  app.use(healthRouter)

  app.use(createRateLimitMiddleware())
  app.use(createCompressionMiddleware())
  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: true, limit: '100kb' }))

  app.use(API_PREFIX, router)

  app.use(notFoundMiddleware)
  app.use(
    createErrorHandlerMiddleware({
      exposeStack: environment.exposeStack,
      logger,
    }),
  )

  return app
}
