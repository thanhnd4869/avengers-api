import { Router } from 'express'

export function createProductRouter({ productController }) {
  const router = Router()

  router.get('/', productController.listProducts)
  router.get('/:slug', productController.getProduct)
  router.get('/:slug/related', productController.listRelatedProducts)
  router.get('/:slug/reviews', productController.listReviews)

  return router
}

export function createProductCategoryRouter({ productController }) {
  const router = Router()

  router.get('/', productController.listCategories)

  return router
}
