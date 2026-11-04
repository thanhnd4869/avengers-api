import { Router } from 'express'

export function createGalleryRouter({ galleryController }) {
  const router = Router()

  router.get('/', galleryController.listGalleries)

  return router
}
