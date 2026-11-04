import { Router } from 'express'
import { createAdminRouter } from './admin.routes.js'
import { createAuthRouter } from './auth.routes.js'
import { createBannerRouter } from './banner.routes.js'
import { createCartRouter } from './cart.routes.js'
import { createOrderRouter } from './order.routes.js'
import { createPageRouter } from './page.routes.js'
import {
  createOrderPaymentRouter,
  createPaymentRouter,
} from './payment.routes.js'
import { createContactMessageRouter } from './contact-message.routes.js'
import { createGalleryRouter } from './gallery.routes.js'
import { createHomeRouter } from './home.routes.js'
import { createMediaRouter } from './media.routes.js'
import { createPlatformRouter } from './platform.routes.js'
import { createPostCategoryRouter } from './post-category.routes.js'
import { createPostRouter } from './post.routes.js'
import {
  createProductCategoryRouter,
  createProductRouter,
} from './product.routes.js'
import { createSocialLinkRouter } from './social-link.routes.js'

export function createRouter({
  homeController,
  bannerController,
  platformController,
  productController,
  reviewController,
  cartController,
  orderController,
  paymentController,
  postController,
  postCommentController,
  pageController,
  postCategoryController,
  mediaController,
  galleryController,
  socialLinkController,
  contactMessageController,
  authController,
  oauthController,
  adminContactMessageController,
  auth,
  authRateLimits,
}) {
  const router = Router()

  router.use(
    '/auth',
    createAuthRouter({
      authController,
      oauthController,
      auth,
      rateLimits: authRateLimits,
    }),
  )
  router.use(
    '/admin',
    createAdminRouter({ auth, adminContactMessageController }),
  )

  router.use('/banners', createBannerRouter({ bannerController }))
  router.use('/platforms', createPlatformRouter({ platformController }))
  router.use(
    '/products',
    createProductRouter({
      productController,
      reviewController,
      auth,
      reviewRateLimit: authRateLimits.review,
    }),
  )
  router.use(
    '/product-categories',
    createProductCategoryRouter({ productController }),
  )
  router.use('/cart', createCartRouter({ cartController, auth }))
  router.use(
    '/orders',
    createOrderRouter({
      orderController,
      auth,
      paymentRouter: createOrderPaymentRouter({
        paymentController,
        auth,
        rateLimit: authRateLimits.payment,
      }),
    }),
  )
  router.use('/payments', createPaymentRouter({ paymentController }))
  router.use(
    '/posts',
    createPostRouter({
      postController,
      postCommentController,
      auth,
      commentRateLimit: authRateLimits.comment,
    }),
  )
  router.use('/pages', createPageRouter({ pageController }))
  router.use(
    '/post-categories',
    createPostCategoryRouter({ postCategoryController }),
  )
  router.use('/media', createMediaRouter({ mediaController }))
  router.use('/galleries', createGalleryRouter({ galleryController }))
  router.use('/social-links', createSocialLinkRouter({ socialLinkController }))
  router.use(
    '/contact',
    createContactMessageRouter({ contactMessageController }),
  )
  router.use(createHomeRouter({ homeController }))

  return router
}
