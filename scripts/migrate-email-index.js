/**
 * Replaces the unique index on `users.email` with a partial one that only
 * covers string values, so several accounts may have no email address at all
 * (a Facebook sign-up without one). Safe to run more than once.
 *
 *   npm run migrate:email-index
 */
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '@config/database.js'
import { getEnvironment, loadEnvironmentFile } from '@config/environment.js'
import { createLogger } from '@config/logger.js'

const INDEX_NAME = 'email_1'
const PARTIAL_FILTER = { email: { $type: 'string' } }

loadEnvironmentFile()

const environment = getEnvironment()
const logger = createLogger(environment)

await connectDatabase({
  mongodbUri: environment.mongodbUri,
  mongodbDbName: environment.mongodbDbName,
  logger,
})

try {
  const users = mongoose.connection.db.collection('users')
  const current = (await users.indexes()).find(
    (index) => index.name === INDEX_NAME,
  )
  const isPartial =
    JSON.stringify(current?.partialFilterExpression) ===
    JSON.stringify(PARTIAL_FILTER)

  if (current?.unique && isPartial) {
    logger.info('The email index is already partial; nothing to do')
  } else {
    if (current) {
      await users.dropIndex(INDEX_NAME)
    }

    await users.createIndex(
      { email: 1 },
      {
        name: INDEX_NAME,
        unique: true,
        partialFilterExpression: PARTIAL_FILTER,
      },
    )
    logger.info('The email index now ignores accounts without an address')
  }
} finally {
  await disconnectDatabase()
}
