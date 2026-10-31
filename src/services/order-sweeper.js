/**
 * Expires unpaid orders and puts their keys back on sale every
 * `intervalSeconds`. Orders are also settled whenever someone reads them, so
 * this only bounds how long held keys stay off the shelf.
 *
 * Runs one sweep at a time; a sweep that fails is logged and the next one
 * tries again. Several API instances may each run it: every write in a sweep
 * is conditional (see order.repository.js). Answers a stop function.
 */
export function startOrderSweeper({ orderService, intervalSeconds, logger }) {
  let running = false

  const tick = async () => {
    if (running) return
    running = true

    try {
      const { expired, released } = await orderService.sweep()

      if (expired || released) {
        logger.info({ expired, released }, 'Swept unpaid orders')
      }
    } catch (error) {
      logger.error({ err: error }, 'Order sweep failed')
    } finally {
      running = false
    }
  }

  const timer = setInterval(tick, intervalSeconds * 1000)

  // Does not keep the process alive on its own during shutdown.
  timer.unref()
  tick()

  return () => clearInterval(timer)
}
