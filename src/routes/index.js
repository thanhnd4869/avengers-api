import { Router } from 'express'
import { createBannerRouter } from './banner.routes.js'
import { createContactMessageRouter } from './contact-message.routes.js'
import { createHomeMediaRouter } from './home-media.routes.js'
import { createHomeRouter } from './home.routes.js'
import { createPlatformRouter } from './platform.routes.js'
import { createPostCategoryRouter } from './post-category.routes.js'
import { createPostRouter } from './post.routes.js'
import { createProductRouter } from './product.routes.js'

export function createRouter({
  homeController,
  bannerController,
  platformController,
  productController,
  postController,
  postCategoryController,
  homeMediaController,
  contactMessageController,
}) {
  const router = Router()

  router.use('/banners', createBannerRouter({ bannerController }))
  router.use('/platforms', createPlatformRouter({ platformController }))
  router.use('/products', createProductRouter({ productController }))
  router.use('/posts', createPostRouter({ postController }))
  router.use(
    '/post-categories',
    createPostCategoryRouter({ postCategoryController }),
  )
  router.use('/home-media', createHomeMediaRouter({ homeMediaController }))
  router.use(
    '/contact',
    createContactMessageRouter({ contactMessageController }),
  )
  router.use(createHomeRouter({ homeController }))

  return router
}
