import { RedisStore } from 'rate-limit-redis'
import { createClient } from 'redis'

const CONNECT_TIMEOUT_MS = 5000
const MAX_RECONNECT_DELAY_MS = 5000

let client = null

/**
 * Opens the shared Redis connection. Like MongoDB, it must be up before the
 * server listens: sessions, email links and rate limits all live there.
 *
 * Once connected, a dropped connection is retried with a growing delay, and
 * commands fail at once instead of queueing, so requests answer 503 while
 * Redis is away rather than hanging.
 */
export async function connectRedis({ redisUrl, logger }) {
  let ready = false
  let reported = false

  client = createClient({
    url: redisUrl,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: CONNECT_TIMEOUT_MS,
      // The first connection is not retried, so a missing Redis stops the
      // start-up with a clear error instead of hanging; later drops are.
      reconnectStrategy: (retries, cause) =>
        ready ? Math.min(2 ** retries * 100, MAX_RECONNECT_DELAY_MS) : cause,
    },
  })

  client.on('ready', () => {
    ready = true
    reported = false
    logger.info('Redis connected')
  })
  client.on('end', () => logger.warn('Redis disconnected'))
  client.on('error', (error) => {
    // Before the first connection the error reaches the caller instead.
    // Afterwards each reconnect attempt fails again, so an outage is logged
    // once rather than every few hundred milliseconds.
    if (ready && !reported) {
      reported = true
      logger.error({ err: error }, 'Redis connection lost; reconnecting')
    }
  })

  try {
    await client.connect()
  } catch (error) {
    client.destroy()
    client = null

    // The socket error sits inside node-redis's wrapper, and a refused
    // connection on Windows carries only a code.
    const cause = error.socketError ?? error.originalError ?? error
    const reason = cause.message || cause.code || 'no response'

    throw new Error(
      `Could not connect to Redis (${reason}). Check REDIS_URL and that the Redis Cloud database is active.`,
      { cause: error },
    )
  }

  return client
}

/** A rate-limit counter store under `prefix`, on the shared connection. */
export function createRateLimitStore(redis, prefix) {
  return new RedisStore({
    prefix,
    sendCommand: (...args) => redis.sendCommand(args),
  })
}

export async function disconnectRedis() {
  if (client?.isOpen) {
    await client.close()
  }

  client = null
}
