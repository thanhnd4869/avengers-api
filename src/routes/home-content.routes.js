import { Router } from 'express'

export function createHomeContentRouter({ homeContentController }) {
  const router = Router()

  router.get('/banners', homeContentController.getBanners)
  router.get('/platforms', homeContentController.getPlatforms)
  router.get('/products', homeContentController.getProducts)
  router.get('/posts', homeContentController.getPosts)
  router.get('/post-categories', homeContentController.getPostCategories)
  router.post('/contact', homeContentController.submitContact)

  return router
}
