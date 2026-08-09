import { loadEnvFile } from 'node:process'
import express from 'express'

// Load local environment variables when a .env file is available.
try {
  loadEnvFile()
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

// Create the Express application.
const app = express()

// Resolve and validate the server configuration.
const hostname = process.env.HOST || 'localhost'
const port = Number.parseInt(process.env.PORT || '8000', 10)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new RangeError('PORT must be an integer between 1 and 65535')
}

// Register application middleware.
app.disable('x-powered-by')
app.use(express.json())

// Register application routes.
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Avengers API',
  })
})

// Start the HTTP server.
const server = app.listen(port, hostname, () => {
  console.log(`Avengers API is running at http://${hostname}:${port}/`)
})

// Gracefully stop accepting new connections on termination.
function shutdown(signal) {
  console.log(`${signal} received; shutting down...`)
  server.close((error) => {
    if (error) {
      console.error(error)
      process.exitCode = 1
    }
  })
}

// Listen for operating-system termination signals.
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
