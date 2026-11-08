import { connectDatabase, disconnectDatabase } from '#config/database.js'
import { getEnvironment, loadEnvironmentFile } from '#config/environment.js'
import { createLogger } from '#config/logger.js'
import {
  connectRedis,
  createRateLimitStore,
  disconnectRedis,
} from '#config/redis.js'
import { createBannerController } from '#controllers/banner.controller.js'
import { createCartController } from '#controllers/cart.controller.js'
import { createAdminController } from '#controllers/admin.controller.js'
import { createAdminCatalogueController } from '#controllers/admin-catalogue.controller.js'
import { createAdminContentController } from '#controllers/admin-content.controller.js'
import { createAdminContactMessageController } from '#controllers/admin-contact-message.controller.js'
import { createAuthController } from '#controllers/auth.controller.js'
import { createContactMessageController } from '#controllers/contact-message.controller.js'
import { createHealthController } from '#controllers/health.controller.js'
import { createGalleryController } from '#controllers/gallery.controller.js'
import { createHomeController } from '#controllers/home.controller.js'
import { createMediaController } from '#controllers/media.controller.js'
import { createOrderController } from '#controllers/order.controller.js'
import { createPaymentController } from '#controllers/payment.controller.js'
import { createOAuthController } from '#controllers/oauth.controller.js'
import { createPageController } from '#controllers/page.controller.js'
import { createPlatformController } from '#controllers/platform.controller.js'
import { createPostCategoryController } from '#controllers/post-category.controller.js'
import { createPostCommentController } from '#controllers/post-comment.controller.js'
import { createPostController } from '#controllers/post.controller.js'
import { createProductController } from '#controllers/product.controller.js'
import { createReviewController } from '#controllers/review.controller.js'
import { createSocialLinkController } from '#controllers/social-link.controller.js'
import { createAuthMiddlewares } from '#middlewares/auth.middleware.js'
import { createAuthRateLimits } from '#middlewares/infrastructure.middleware.js'
import * as adminRepository from '#repositories/admin.repository.js'
import * as adminCatalogueRepository from '#repositories/admin-catalogue.repository.js'
import * as adminContentRepository from '#repositories/admin-content.repository.js'
import * as bannerRepository from '#repositories/banner.repository.js'
import * as cartRepository from '#repositories/cart.repository.js'
import * as contactMessageRepository from '#repositories/contact-message.repository.js'
import {
  createRedisPing,
  pingDatabase,
} from '#repositories/health.repository.js'
import * as galleryRepository from '#repositories/gallery.repository.js'
import * as mediaRepository from '#repositories/media.repository.js'
import * as orderRepository from '#repositories/order.repository.js'
import * as pageRepository from '#repositories/page.repository.js'
import * as platformRepository from '#repositories/platform.repository.js'
import * as postCategoryRepository from '#repositories/post-category.repository.js'
import * as postCommentRepository from '#repositories/post-comment.repository.js'
import * as postRepository from '#repositories/post.repository.js'
import * as productRepository from '#repositories/product.repository.js'
import * as reviewRepository from '#repositories/review.repository.js'
import { createRedisKeys } from '#repositories/redis-keys.js'
import { createSessionRepository } from '#repositories/session.repository.js'
import * as socialLinkRepository from '#repositories/social-link.repository.js'
import * as userIdentityRepository from '#repositories/user-identity.repository.js'
import { createUserTokenRepository } from '#repositories/user-token.repository.js'
import * as userRepository from '#repositories/user.repository.js'
import { createHealthRouter } from '#routes/health.routes.js'
import { createRouter } from '#routes/index.js'
import { createAdminService } from '#services/admin.service.js'
import { createAdminCatalogueService } from '#services/admin-catalogue.service.js'
import { createAdminContentService } from '#services/admin-content.service.js'
import { createAdminContactMessageService } from '#services/admin-contact-message.service.js'
import { createAuthService } from '#services/auth.service.js'
import { createBannerService } from '#services/banner.service.js'
import { createCartService } from '#services/cart.service.js'
import { createContactMessageService } from '#services/contact-message.service.js'
import { createGalleryService } from '#services/gallery.service.js'
import { createHealthService } from '#services/health.service.js'
import { createHomeService } from '#services/home.service.js'
import { createMediaService } from '#services/media.service.js'
import { createOAuthService } from '#services/oauth.service.js'
import { startOrderSweeper } from '#services/order-sweeper.js'
import { createOrderService } from '#services/order.service.js'
import { createPageService } from '#services/page.service.js'
import { createPaymentService } from '#services/payment.service.js'
import { createPlatformService } from '#services/platform.service.js'
import { createPostCategoryService } from '#services/post-category.service.js'
import { createPostCommentService } from '#services/post-comment.service.js'
import { createPostService } from '#services/post.service.js'
import { createProductService } from '#services/product.service.js'
import { createReviewService } from '#services/review.service.js'
import { createSocialLinkService } from '#services/social-link.service.js'
import { createAccessTokenSigner } from '#utils/jwt.js'
import { createKeyCipher } from '#utils/key-cipher.js'
import { createMailer } from '#utils/mailer.js'
import {
  OAUTH_FLOW_TTL_SECONDS,
  createOAuthFlowSigner,
} from '#utils/oauth-flow.js'
import {
  codeChallengeFor,
  createOAuthProviders,
} from '#utils/oauth-providers.js'
import { createVnpayClient } from '#utils/vnpay.js'
import { createApp } from './app.js'
import {
  describeListenError,
  registerShutdownHandlers,
  startServer,
} from './server.js'

loadEnvironmentFile()

const environment = getEnvironment()
const logger = createLogger(environment)

let stopOrderSweeper = () => {}

async function closeConnections() {
  stopOrderSweeper()
  await Promise.allSettled([disconnectDatabase(), disconnectRedis()])
}

let redis

try {
  await connectDatabase({
    mongodbUri: environment.mongodbUri,
    mongodbDbName: environment.mongodbDbName,
    logger,
  })
  redis = await connectRedis({ redisUrl: environment.redisUrl, logger })
} catch (error) {
  logger.fatal({ err: error }, error.message)
  await closeConnections()
  process.exit(1)
}

const redisKeys = createRedisKeys(environment.redisKeyPrefix)
const sessionRepository = createSessionRepository({ redis, keys: redisKeys })
const userTokenRepository = createUserTokenRepository({
  redis,
  keys: redisKeys,
})
const rateLimitStoreFor = (name) =>
  createRateLimitStore(redis, redisKeys.rateLimit(name))

const healthService = createHealthService()
healthService.registerProbe('mongodb', pingDatabase)
healthService.registerProbe('redis', createRedisPing(redis))

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
const reviewController = createReviewController({
  reviewService: createReviewService({
    reviewRepository,
    productRepository,
    userRepository,
  }),
})
const productController = createProductController({
  productService: createProductService({ productRepository }),
})
const mailer = createMailer({
  smtp: environment.smtp,
  mailFrom: environment.mailFrom,
  logger,
})
const keyCipher = createKeyCipher(environment.keyEncryptionKey)
const cartService = createCartService({ cartRepository })
const cartController = createCartController({ cartService })
const orderService = createOrderService({
  orderRepository,
  cartRepository,
  cartService,
  keyCipher,
  holdMinutes: environment.orders.holdMinutes,
  paymentGraceSeconds: environment.orders.paymentGraceSeconds,
  logger,
})
const orderController = createOrderController({ orderService })
const paymentService = createPaymentService({
  orderRepository,
  cartService,
  vnpay: environment.vnpay ? createVnpayClient(environment.vnpay) : null,
  keyCipher,
  userRepository,
  mailer,
  appUrl: environment.appUrl,
  apiUrl: environment.oauth.apiUrl,
  logger,
})
const paymentController = createPaymentController({ paymentService })

if (!environment.vnpay) {
  logger.info('VNPay payment is off: no credentials set')
}
const postController = createPostController({
  postService: createPostService({ postRepository }),
})
const postCommentController = createPostCommentController({
  postCommentService: createPostCommentService({
    postCommentRepository,
    postRepository,
    userRepository,
  }),
})
const pageController = createPageController({
  pageService: createPageService({ pageRepository }),
})
const postCategoryController = createPostCategoryController({
  postCategoryService: createPostCategoryService({ postCategoryRepository }),
})
const mediaController = createMediaController({
  mediaService: createMediaService({ mediaRepository }),
})
const galleryController = createGalleryController({
  galleryService: createGalleryService({ galleryRepository }),
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
  userIdentityRepository,
  cartRepository,
  reviewRepository,
  postCommentRepository,
  accessTokens: createAccessTokenSigner({
    secret: environment.jwtSecret,
    ttlMinutes: environment.accessTokenTtlMinutes,
  }),
  mailer,
  logger,
  appUrl: environment.appUrl,
  refreshTokenTtlDays: environment.refreshTokenTtlDays,
})
const authController = createAuthController({
  authService,
  isProduction: environment.isProduction,
})
const oauthProviders = createOAuthProviders(environment.oauth)
const oauthController = createOAuthController({
  oauthService: createOAuthService({
    providers: oauthProviders,
    flowSigner: createOAuthFlowSigner({ secret: environment.jwtSecret }),
    codeChallengeFor,
    authService,
    userRepository,
    userIdentityRepository,
    userTokenRepository,
    sessionRepository,
    appUrl: environment.appUrl,
    logger,
  }),
  setRefreshCookie: authController.setRefreshCookie,
  isProduction: environment.isProduction,
  flowTtlSeconds: OAUTH_FLOW_TTL_SECONDS,
})

if (Object.keys(oauthProviders).length === 0) {
  logger.info('Sign-in with Google and Facebook is off: no credentials set')
}

const auth = createAuthMiddlewares({
  resolveAccessToken: authService.authenticateAccessToken,
})
const adminController = createAdminController({
  adminService: createAdminService({ adminRepository }),
})
const adminCatalogueController = createAdminCatalogueController({
  adminCatalogueService: createAdminCatalogueService({
    adminCatalogueRepository,
    keyCipher,
    logger,
  }),
})
const adminContentController = createAdminContentController({
  adminContentService: createAdminContentService({
    adminContentRepository,
    logger,
  }),
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
    adminController,
    adminCatalogueController,
    adminContentController,
    adminContactMessageController,
    auth,
    authRateLimits: createAuthRateLimits({
      isProduction: environment.isProduction,
      createStore: rateLimitStoreFor,
    }),
  }),
  healthRouter: createHealthRouter({ healthController }),
  environment,
  createRateLimitStore: rateLimitStoreFor,
  logger,
})

let server

try {
  server = await startServer({
    app,
    hostname: environment.hostname,
    port: environment.port,
    logger,
  })
} catch (error) {
  logger.fatal({ err: error }, describeListenError(error, environment))
  await closeConnections()
  process.exit(1)
}

stopOrderSweeper = startOrderSweeper({
  orderService,
  intervalSeconds: environment.orders.sweepIntervalSeconds,
  logger,
})

registerShutdownHandlers({
  server,
  logger,
  onShutdown: closeConnections,
})
