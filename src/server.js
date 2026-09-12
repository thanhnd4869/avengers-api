export function startServer({ app, hostname, port, logger }) {
  const server = app.listen(port, hostname, () => {
    logger.info(`Avengers API is running at http://${hostname}:${port}/`)
  })

  return server
}

/**
 * Unexpected process-level faults funnel through the same path as signals, so
 * shutdown logic lives in one place and cannot run twice.
 */
export function registerShutdownHandlers({
  server,
  logger,
  onShutdown = async () => {},
}) {
  let shuttingDown = false

  async function shutdown(reason, exitCode = 0) {
    if (shuttingDown) return
    shuttingDown = true

    logger.info(`${reason} received; shutting down...`)

    try {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })

      await onShutdown()

      logger.info('Shutdown complete')
      process.exitCode = exitCode
    } catch (error) {
      logger.error({ err: error }, 'Shutdown failed')
      process.exit(1)
    }
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))

  process.once('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection')
    shutdown('unhandledRejection', 1)
  })

  process.once('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception')
    shutdown('uncaughtException', 1)
  })

  return shutdown
}
