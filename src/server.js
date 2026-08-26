export function startServer({ app, hostname, port }) {
  return app.listen(port, hostname, () => {
    console.log(`Avengers API is running at http://${hostname}:${port}/`)
  })
}

export function registerShutdownHandlers(server) {
  function shutdown(signal) {
    console.log(`${signal} received; shutting down...`)

    server.close((error) => {
      if (error) {
        console.error(error)
        process.exitCode = 1
      }
    })
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}
