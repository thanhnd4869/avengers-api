import { Router } from 'express'
import { createAdminRouter } from './admin.routes.js'
import { createAuthRouter } from './auth.routes.js'
import { createBannerRouter } from './banner.routes.js'
import { createContactMessageRouter } from './contact-message.routes.js'
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
  postController,
  postCategoryController,
  mediaController,
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
  router.use('/products', createProductRouter({ productController }))
  router.use(
    '/product-categories',
    createProductCategoryRouter({ productController }),
  )
  router.use('/posts', createPostRouter({ postController }))
  router.use(
    '/post-categories',
    createPostCategoryRouter({ postCategoryController }),
  )
  router.use('/media', createMediaRouter({ mediaController }))
  router.use('/social-links', createSocialLinkRouter({ socialLinkController }))
  router.use(
    '/contact',
    createContactMessageRouter({ contactMessageController }),
  )
  router.use(createHomeRouter({ homeController }))

  return router
}
