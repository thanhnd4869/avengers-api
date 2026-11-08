import { Router } from 'express'
import { USER_ROLE } from '#constants/auth.js'

/**
 * Everything under `/admin` is guarded once here, so a new admin route cannot
 * be added without protection by forgetting a middleware.
 */
export function createAdminRouter({
  auth,
  adminController,
  adminCatalogueController,
  adminContentController,
  adminContactMessageController,
}) {
  const router = Router()

  router.use(
    auth.authenticate,
    auth.authorize(USER_ROLE.ADMIN),
    auth.requireVerifiedEmail,
  )

  router.get('/overview', adminController.getOverview)
  router.get('/orders', adminController.listOrders)
  router.get('/orders/:number', adminController.getOrder)
  router.get('/payments', adminController.listPayments)
  router.post('/payments/:id/refund', adminController.markPaymentRefunded)
  router.get('/users', adminController.listUsers)
  router.get('/users/:id', adminController.getUser)

  const catalogue = adminCatalogueController

  router.get('/platforms', catalogue.listPlatforms)
  router.get('/product-categories', catalogue.listCategories)
  router.get('/products', catalogue.listProducts)
  router.post('/products', catalogue.createProduct)
  router.get('/products/:id', catalogue.getProduct)
  router.patch('/products/:id', catalogue.updateProduct)
  router.post('/products/:id/variants', catalogue.createVariant)
  router.patch('/products/:id/variants/:variantId', catalogue.updateVariant)
  router.delete('/products/:id/variants/:variantId', catalogue.deleteVariant)
  router.post('/products/:id/variants/:variantId/keys', catalogue.addKeys)

  const content = adminContentController

  router.get('/banners', content.listBanners)
  router.post('/banners', content.createBanner)
  router.patch('/banners/:id', content.updateBanner)
  router.delete('/banners/:id', content.deleteBanner)
  router.get('/post-categories', content.listPostCategories)
  router.get('/posts', content.listPosts)
  router.post('/posts', content.createPost)
  router.get('/posts/:id', content.getPost)
  router.patch('/posts/:id', content.updatePost)
  router.delete('/posts/:id', content.deletePost)
  router.get('/comments', content.listComments)
  router.delete('/comments/:id', content.deleteComment)

  router.get(
    '/contact-messages',
    adminContactMessageController.listContactMessages,
  )
  router.patch(
    '/contact-messages/:id',
    adminContactMessageController.updateContactMessageStatus,
  )

  return router
}
