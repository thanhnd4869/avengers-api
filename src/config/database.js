import mongoose from 'mongoose'

export async function connectDatabase({ mongodbUri, logger }) {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'))
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected'),
  )
  mongoose.connection.on('error', (error) =>
    logger.error({ err: error }, 'MongoDB error'),
  )

  await mongoose.connect(mongodbUri)

  return mongoose.connection
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}

/**
 * Readiness probe for the database.
 *
 * Uses a short timeout of its own so that an unreachable cluster fails the
 * probe quickly instead of holding the health endpoint open.
 */
export async function pingDatabase() {
  await mongoose.connection.db.admin().ping({ maxTimeMS: 2000 })
}
