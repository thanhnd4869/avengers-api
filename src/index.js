import { createApp } from './app.js'
import { getEnvironment, loadEnvironmentFile } from './config/environment.js'
import { createRouter } from './routes/index.js'
import { registerShutdownHandlers, startServer } from './server.js'

loadEnvironmentFile()

const { hostname, port } = getEnvironment()
const router = createRouter()
const app = createApp({ router })
const server = startServer({ app, hostname, port })

registerShutdownHandlers(server)
