import { Router } from 'express'

export function createMediaRouter({ mediaController }) {
  const router = Router()

  router.get('/', mediaController.listMedia)

  return router
}
