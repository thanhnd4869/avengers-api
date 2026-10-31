/**
 * Tops every variant up to a number of available fake keys, so a development
 * database can be shopped from without real stock.
 *
 *   npm run keys:fake                 at least 50 available keys per variant
 *   npm run keys:fake -- --per-variant 5
 *
 * Refuses to run when NODE_ENV is `production`. Users, carts and orders are
 * left as they are.
 */
import { parseArgs } from 'node:util'
import { connectDatabase, disconnectDatabase } from '#config/database.js'
import { getEnvironment, loadEnvironmentFile } from '#config/environment.js'
import { createLogger } from '#config/logger.js'
import {
  addProductKeys,
  findVariantsWithKeyCounts,
} from '#repositories/product-key.repository.js'
import { createKeyCipher } from '#utils/key-cipher.js'
import { generateFakeKeys } from './fake-keys.js'

loadEnvironmentFile()

const environment = getEnvironment()
const logger = createLogger(environment)

if (environment.isProduction) {
  logger.error('Refusing to add fake keys: NODE_ENV is production')
  process.exit(1)
}

const { values } = parseArgs({
  options: { 'per-variant': { type: 'string', default: '50' } },
})
const target = Number(values['per-variant'])

if (!Number.isInteger(target) || target < 0 || target > 10000) {
  logger.error('--per-variant must be an integer from 0 to 10000')
  process.exit(1)
}

const keyCipher = createKeyCipher(environment.keyEncryptionKey)

await connectDatabase({
  mongodbUri: environment.mongodbUri,
  mongodbDbName: environment.mongodbDbName,
  logger,
})

try {
  let added = 0

  for (const variant of await findVariantsWithKeyCounts()) {
    const missing = target - (variant.availableKeys ?? 0)

    if (missing > 0) {
      added += await addProductKeys(
        variant._id,
        generateFakeKeys(missing, keyCipher),
      )
    }
  }

  logger.info(`Added ${added} fake keys (target ${target} per variant)`)
} finally {
  await disconnectDatabase()
}
