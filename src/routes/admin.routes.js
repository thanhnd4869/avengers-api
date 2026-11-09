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
  adminUploadController,
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
  router.post(
    '/payments/:id/refund/vnpay',
    adminController.refundPaymentViaVnpay,
  )
  router.post('/payments/:id/refund', adminController.markPaymentRefunded)
  router.get('/users', adminController.listUsers)
  router.get('/users/:id', adminController.getUser)

  const catalogue = adminCatalogueController

  router.get('/platforms', catalogue.listPlatforms)
  router.post('/platforms', catalogue.createPlatform)
  router.patch('/platforms/:id', catalogue.updatePlatform)
  router.delete('/platforms/:id', catalogue.deletePlatform)
  router.get('/product-categories', catalogue.listCategories)
  router.post('/product-categories', catalogue.createCategory)
  router.patch('/product-categories/:id', catalogue.updateCategory)
  router.delete('/product-categories/:id', catalogue.deleteCategory)
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
  router.post('/post-categories', content.createPostCategory)
  router.patch('/post-categories/:id', content.updatePostCategory)
  router.delete('/post-categories/:id', content.deletePostCategory)
  router.get('/pages', content.listPages)
  router.patch('/pages/:slug', content.updatePage)
  router.get('/galleries', content.listGalleries)
  router.post('/galleries', content.createGallery)
  router.patch('/galleries/:id', content.updateGallery)
  router.delete('/galleries/:id', content.deleteGallery)
  router.get('/media', content.listMedia)
  router.post('/media', content.createMedia)
  router.patch('/media/:id', content.updateMedia)
  router.delete('/media/:id', content.deleteMedia)
  router.get('/social-links', content.listSocialLinks)
  router.post('/social-links', content.createSocialLink)
  router.patch('/social-links/:id', content.updateSocialLink)
  router.delete('/social-links/:id', content.deleteSocialLink)
  router.get('/posts', content.listPosts)
  router.post('/posts', content.createPost)
  router.get('/posts/:id', content.getPost)
  router.patch('/posts/:id', content.updatePost)
  router.delete('/posts/:id', content.deletePost)
  router.get('/comments', content.listComments)
  router.delete('/comments/:id', content.deleteComment)

  router.get('/uploads', adminUploadController.getUploadConfig)
  router.post('/uploads/signature', adminUploadController.createUploadSignature)

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
