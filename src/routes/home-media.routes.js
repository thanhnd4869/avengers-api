import { Router } from 'express'

export function createHomeMediaRouter({ homeMediaController }) {
  const router = Router()

  router.get('/', homeMediaController.getHomeMedia)

  return router
}
