import { Router } from 'express'

export function createBannerRouter({ bannerController }) {
  const router = Router()

  router.get('/', bannerController.listBanners)

  return router
}
