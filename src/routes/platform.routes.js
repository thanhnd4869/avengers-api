import { Router } from 'express'

export function createPlatformRouter({ platformController }) {
  const router = Router()

  router.get('/', platformController.listPlatforms)

  return router
}
