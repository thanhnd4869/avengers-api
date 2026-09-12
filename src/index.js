import { connectDatabase, disconnectDatabase } from '@config/database.js'
import { getEnvironment, loadEnvironmentFile } from '@config/environment.js'
import { createLogger } from '@config/logger.js'
import { createHealthController } from '@controllers/health.controller.js'
import { createHomeController } from '@controllers/home.controller.js'
import { pingDatabase } from '@repositories/health.repository.js'
import { createHealthRouter } from '@routes/health.routes.js'
import { createRouter } from '@routes/index.js'
import { createHealthService } from '@services/health.service.js'
import { createHomeService } from '@services/home.service.js'
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

const app = createApp({
  router: createRouter({ homeController }),
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
