import { Router } from 'express'

export function createSitemapRouter({ sitemapController }) {
  const router = Router()

  router.get('/', sitemapController.getSitemap)

  return router
}
