import express from 'express'
import { errorHandlerMiddleware } from './middlewares/error-handler.middleware.js'
import { notFoundMiddleware } from './middlewares/not-found.middleware.js'

export function createApp({ router }) {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json())
  app.use(router)
  app.use(notFoundMiddleware)
  app.use(errorHandlerMiddleware)

  return app
}
