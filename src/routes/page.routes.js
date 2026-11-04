import { Router } from 'express'

export function createPageRouter({ pageController }) {
  const router = Router()

  router.get('/:slug', pageController.getPage)

  return router
}
