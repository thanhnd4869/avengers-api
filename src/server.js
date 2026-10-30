/**
 * Resolves once the port is bound. Express 5 hands a listen failure (such as
 * the port being taken by another instance) to this callback instead of
 * throwing, so it must be checked or the process keeps running unreachable.
 */
export function startServer({ app, hostname, port, logger }) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, hostname, (error) => {
      if (error) {
        reject(error)
        return
      }

      logger.info(`Avengers API is running at http://${hostname}:${port}/`)
      resolve(server)
    })
  })
}

export function describeListenError(error, { hostname, port }) {
  if (error.code === 'EADDRINUSE') {
    return `Port ${port} on ${hostname} is already in use; stop the other process or set another PORT`
  }

  if (error.code === 'EACCES') {
    return `No permission to listen on port ${port}`
  }

  return 'Could not start the HTTP server'
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
