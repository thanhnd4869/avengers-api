import mongoose from 'mongoose'

export async function connectDatabase({ mongodbUri, mongodbDbName, logger }) {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'))
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected'),
  )
  mongoose.connection.on('error', (error) =>
    logger.error({ err: error }, 'MongoDB error'),
  )

  // An explicit name is required: without it the driver silently falls back
  // to `test`, which is easy to miss until data lands in the wrong place.
  await mongoose.connect(mongodbUri, { dbName: mongodbDbName })

  logger.info(`Using database "${mongoose.connection.name}"`)

  return mongoose.connection
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}

export async function pingDatabase() {
  await mongoose.connection.db.admin().ping({ maxTimeMS: 2000 })
}
