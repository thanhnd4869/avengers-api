import { connectDatabase, disconnectDatabase } from '@config/database.js'
import { getEnvironment, loadEnvironmentFile } from '@config/environment.js'
import { createLogger } from '@config/logger.js'
import { createBannerController } from '@controllers/banner.controller.js'
import { createAdminContactMessageController } from '@controllers/admin-contact-message.controller.js'
import { createAuthController } from '@controllers/auth.controller.js'
import { createContactMessageController } from '@controllers/contact-message.controller.js'
import { createHealthController } from '@controllers/health.controller.js'
import { createHomeController } from '@controllers/home.controller.js'
import { createMediaController } from '@controllers/media.controller.js'
import { createPlatformController } from '@controllers/platform.controller.js'
import { createPostCategoryController } from '@controllers/post-category.controller.js'
import { createPostController } from '@controllers/post.controller.js'
import { createProductController } from '@controllers/product.controller.js'
import { createSocialLinkController } from '@controllers/social-link.controller.js'
import { createAuthMiddlewares } from '@middlewares/auth.middleware.js'
import { createAuthRateLimits } from '@middlewares/infrastructure.middleware.js'
import * as bannerRepository from '@repositories/banner.repository.js'
import * as contactMessageRepository from '@repositories/contact-message.repository.js'
import { pingDatabase } from '@repositories/health.repository.js'
import * as mediaRepository from '@repositories/media.repository.js'
import * as platformRepository from '@repositories/platform.repository.js'
import * as postCategoryRepository from '@repositories/post-category.repository.js'
import * as postRepository from '@repositories/post.repository.js'
import * as productRepository from '@repositories/product.repository.js'
import * as sessionRepository from '@repositories/session.repository.js'
import * as socialLinkRepository from '@repositories/social-link.repository.js'
import * as userTokenRepository from '@repositories/user-token.repository.js'
import * as userRepository from '@repositories/user.repository.js'
import { createHealthRouter } from '@routes/health.routes.js'
import { createRouter } from '@routes/index.js'
import { createAdminContactMessageService } from '@services/admin-contact-message.service.js'
import { createAuthService } from '@services/auth.service.js'
import { createBannerService } from '@services/banner.service.js'
import { createContactMessageService } from '@services/contact-message.service.js'
import { createHealthService } from '@services/health.service.js'
import { createHomeService } from '@services/home.service.js'
import { createMediaService } from '@services/media.service.js'
import { createPlatformService } from '@services/platform.service.js'
import { createPostCategoryService } from '@services/post-category.service.js'
import { createPostService } from '@services/post.service.js'
import { createProductService } from '@services/product.service.js'
import { createSocialLinkService } from '@services/social-link.service.js'
import { createAccessTokenSigner } from '@utils/jwt.js'
import { createMailer } from '@utils/mailer.js'
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
  platformService: createPlatformService({ platformRepository }),
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
const mediaController = createMediaController({
  mediaService: createMediaService({ mediaRepository }),
})
const socialLinkController = createSocialLinkController({
  socialLinkService: createSocialLinkService({ socialLinkRepository }),
})
const contactMessageController = createContactMessageController({
  contactMessageService: createContactMessageService({
    contactMessageRepository,
  }),
})

const authService = createAuthService({
  userRepository,
  sessionRepository,
  userTokenRepository,
  accessTokens: createAccessTokenSigner({
    secret: environment.jwtSecret,
    ttlMinutes: environment.accessTokenTtlMinutes,
  }),
  mailer: createMailer({
    smtp: environment.smtp,
    mailFrom: environment.mailFrom,
    logger,
  }),
  logger,
  appUrl: environment.appUrl,
  refreshTokenTtlDays: environment.refreshTokenTtlDays,
})
const authController = createAuthController({
  authService,
  isProduction: environment.isProduction,
})
const auth = createAuthMiddlewares({
  resolveAccessToken: authService.authenticateAccessToken,
})
const adminContactMessageController = createAdminContactMessageController({
  adminContactMessageService: createAdminContactMessageService({
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
    mediaController,
    socialLinkController,
    contactMessageController,
    authController,
    adminContactMessageController,
    auth,
    authRateLimits: createAuthRateLimits(environment),
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
