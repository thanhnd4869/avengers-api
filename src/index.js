import { connectDatabase, disconnectDatabase } from '@config/database.js'
import { getEnvironment, loadEnvironmentFile } from '@config/environment.js'
import { createLogger } from '@config/logger.js'
import { createBannerController } from '@controllers/banner.controller.js'
import { createContactMessageController } from '@controllers/contact-message.controller.js'
import { createHealthController } from '@controllers/health.controller.js'
import { createHomeController } from '@controllers/home.controller.js'
import { createHomeMediaController } from '@controllers/home-media.controller.js'
import { createPlatformController } from '@controllers/platform.controller.js'
import { createPostCategoryController } from '@controllers/post-category.controller.js'
import { createPostController } from '@controllers/post.controller.js'
import { createProductController } from '@controllers/product.controller.js'
import * as bannerRepository from '@repositories/banner.repository.js'
import * as contactMessageRepository from '@repositories/contact-message.repository.js'
import { pingDatabase } from '@repositories/health.repository.js'
import * as homeMediaRepository from '@repositories/home-media.repository.js'
import * as platformRepository from '@repositories/platform.repository.js'
import * as postCategoryRepository from '@repositories/post-category.repository.js'
import * as postRepository from '@repositories/post.repository.js'
import * as productRepository from '@repositories/product.repository.js'
import { createHealthRouter } from '@routes/health.routes.js'
import { createRouter } from '@routes/index.js'
import { createBannerService } from '@services/banner.service.js'
import { createContactMessageService } from '@services/contact-message.service.js'
import { createHealthService } from '@services/health.service.js'
import { createHomeService } from '@services/home.service.js'
import { createHomeMediaService } from '@services/home-media.service.js'
import { createPlatformService } from '@services/platform.service.js'
import { createPostCategoryService } from '@services/post-category.service.js'
import { createPostService } from '@services/post.service.js'
import { createProductService } from '@services/product.service.js'
import { createApp } from './app.js'
import { registerShutdownHandlers, startServer } from './server.js'

loadEnvironmentFile()

const environment = getEnvironment()
const logger = createLogger(environment)

await connectDatabase({
  mongodbUri: environment.mongodbUri,
  mongodbDbName: environment.mongodbDbName,
  logger,
})

const healthService = createHealthService()
healthService.registerProbe('mongodb', pingDatabase)

const healthController = createHealthController({ healthService })
const homeController = createHomeController({
  homeService: createHomeService(),
})
const bannerController = createBannerController({
  bannerService: createBannerService({ bannerRepository }),
})
const platformController = createPlatformController({
  platformService: createPlatformService({
    platformRepository,
    productRepository,
  }),
})
const productController = createProductController({
  productService: createProductService({ productRepository }),
})
const postController = createPostController({
  postService: createPostService({ postRepository }),
})
const postCategoryController = createPostCategoryController({
  postCategoryService: createPostCategoryService({ postCategoryRepository }),
})
const homeMediaController = createHomeMediaController({
  homeMediaService: createHomeMediaService({ homeMediaRepository }),
})
const contactMessageController = createContactMessageController({
  contactMessageService: createContactMessageService({
    contactMessageRepository,
  }),
})

const app = createApp({
  router: createRouter({
    homeController,
    bannerController,
    platformController,
    productController,
    postController,
    postCategoryController,
    homeMediaController,
    contactMessageController,
  }),
  healthRouter: createHealthRouter({ healthController }),
  environment,
  logger,
})

const server = startServer({
  app,
  hostname: environment.hostname,
  port: environment.port,
  logger,
})

registerShutdownHandlers({
  server,
  logger,
  onShutdown: disconnectDatabase,
})
