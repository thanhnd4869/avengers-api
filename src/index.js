import { createApp } from './app.js'
import {
  connectDatabase,
  disconnectDatabase,
  pingDatabase,
} from './config/database.js'
import { getEnvironment, loadEnvironmentFile } from './config/environment.js'
import { createLogger } from './config/logger.js'
import { createHealthRouter } from './routes/health.routes.js'
import { createRouter } from './routes/index.js'
import { registerShutdownHandlers, startServer } from './server.js'
import { createHealthService } from './services/health.service.js'

loadEnvironmentFile()

const environment = getEnvironment()
const logger = createLogger(environment)

await connectDatabase({ mongodbUri: environment.mongodbUri, logger })

const healthService = createHealthService()
healthService.registerProbe('mongodb', pingDatabase)

const app = createApp({
  router: createRouter(),
  healthRouter: createHealthRouter({ healthService }),
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
