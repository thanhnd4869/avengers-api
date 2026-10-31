/**
 * Database migrations, run with migrate-mongo.
 *
 *   npm run migrate -- status               lists every migration and when it ran
 *   npm run migrate -- up                   runs the pending ones, oldest first
 *   npm run migrate -- down                 reverts the last one that ran
 *   npm run migrate -- create <description> adds a new file to migrations/
 *
 * `up` belongs in every deploy, before the new API version starts.
 */
import { config, create, database, down, status, up } from 'migrate-mongo'
import { getEnvironment, loadEnvironmentFile } from '#config/environment.js'
import { createLogger } from '#config/logger.js'
import {
  MIGRATIONS_LOCK_COLLECTION,
  MIGRATIONS_LOCK_TTL_SECONDS,
  createMigrationConfig,
} from '#config/migrations.js'

const COMMANDS = ['status', 'up', 'down', 'create']
const DESCRIPTION_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const LOCK_ID = 'migrate'
const DUPLICATE_KEY = 11000

/**
 * Keeps two deploys starting at once from both migrating. The fixed `_id`
 * makes taking the lock a single atomic insert, and the TTL index frees it
 * if a run is killed half-way. Resolves to a release function, or `null` when
 * another run holds the lock.
 */
async function acquireLock(db) {
  const locks = db.collection(MIGRATIONS_LOCK_COLLECTION)

  await locks.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: MIGRATIONS_LOCK_TTL_SECONDS },
  )

  try {
    await locks.insertOne({ _id: LOCK_ID, createdAt: new Date() })
  } catch (error) {
    if (error.code === DUPLICATE_KEY) return null
    throw error
  }

  return () => locks.deleteOne({ _id: LOCK_ID })
}

loadEnvironmentFile()

const environment = getEnvironment()
const logger = createLogger(environment)
const [command, ...rest] = process.argv.slice(2)

if (!COMMANDS.includes(command)) {
  logger.error(
    `Usage: npm run migrate -- <${COMMANDS.join('|')}> [description]`,
  )
  process.exit(1)
}

config.set(createMigrationConfig(environment))

if (command === 'create') {
  // Becomes part of the file name, so it is kept to one readable slug.
  const description = rest.join('-').toLowerCase()

  if (!DESCRIPTION_PATTERN.test(description)) {
    logger.error(
      'Describe the change in lowercase words, e.g. "rename-post-author"',
    )
    process.exit(1)
  }

  logger.info(`Created migrations/${await create(description)}`)
  process.exit(0)
}

const { db, client } = await database.connect()
let releaseLock = null

try {
  if (command !== 'status') {
    releaseLock = await acquireLock(db)

    if (!releaseLock) {
      throw new Error(
        `Another migration is running. If none is, the lock clears itself within ${MIGRATIONS_LOCK_TTL_SECONDS / 60} minutes.`,
      )
    }
  }

  if (command === 'status') {
    const items = await status(db)

    if (items.length === 0) logger.info('No migrations yet')

    for (const item of items) {
      logger.info(`${item.appliedAt.padEnd(24)} ${item.fileName}`)
    }
  }

  if (command === 'up') {
    const migrated = await up(db, client)

    if (migrated.length === 0) logger.info('Nothing to migrate')

    for (const fileName of migrated) logger.info(`Migrated up: ${fileName}`)
  }

  if (command === 'down') {
    const reverted = await down(db, client)

    if (reverted.length === 0) logger.info('Nothing to revert')

    for (const fileName of reverted) logger.info(`Migrated down: ${fileName}`)
  }
} catch (error) {
  // Migrations before the failing one stay applied and recorded.
  for (const fileName of error.migrated ?? []) {
    logger.info(`Migrated up before the failure: ${fileName}`)
  }
  logger.error({ err: error }, error.message)
  process.exitCode = 1
} finally {
  await releaseLock?.()
  await client.close()
}
