import { Router } from 'express'

export function createProductRouter({
  productController,
  reviewController,
  auth,
  reviewRateLimit,
}) {
  const router = Router()

  router.get('/', productController.listProducts)
  router.get('/:slug', productController.getProduct)
  router.get('/:slug/related', productController.listRelatedProducts)
  // Signed-in readers see which review is theirs.
  router.get('/:slug/reviews', auth.optionalAuth, productController.listReviews)
  router.get(
    '/:slug/reviews/mine',
    auth.authenticate,
    reviewController.getMyReview,
  )
  router.post(
    '/:slug/reviews',
    reviewRateLimit,
    auth.authenticate,
    reviewController.createReview,
  )
  router.patch(
    '/:slug/reviews/mine',
    reviewRateLimit,
    auth.authenticate,
    reviewController.updateReview,
  )
  router.delete(
    '/:slug/reviews/mine',
    auth.authenticate,
    reviewController.deleteReview,
  )

  return router
}

export function createProductCategoryRouter({ productController }) {
  const router = Router()

  router.get('/', productController.listCategories)

  return router
}
