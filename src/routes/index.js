import { Router } from 'express'
import { createHomeRouter } from './home.routes.js'

export function createRouter({ homeController }) {
  const router = Router()

  router.use(createHomeRouter({ homeController }))

  return router
}
