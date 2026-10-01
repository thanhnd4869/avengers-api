import { Router } from 'express'

export function createSocialLinkRouter({ socialLinkController }) {
  const router = Router()

  router.get('/', socialLinkController.listSocialLinks)

  return router
}
