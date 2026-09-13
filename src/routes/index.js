import { Router } from 'express'
import { createHomeContentRouter } from './home-content.routes.js'
import { createHomeRouter } from './home.routes.js'

export function createRouter({ homeController, homeContentController }) {
  const router = Router()

  router.use(createHomeContentRouter({ homeContentController }))
  router.use(createHomeRouter({ homeController }))

  return router
}
