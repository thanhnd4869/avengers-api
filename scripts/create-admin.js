/**
 * Creates an administrator, or promotes and resets an existing account.
 *
 *   npm run create-admin -- --email admin@example.com --name "Admin"
 *
 * The password is asked for without echo. Where no terminal is attached (CI,
 * containers), it is read from the ADMIN_PASSWORD environment variable
 * instead, so it never appears in the shell history or the process list.
 */
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { connectDatabase, disconnectDatabase } from '#config/database.js'
import { getEnvironment, loadEnvironmentFile } from '#config/environment.js'
import { createLogger } from '#config/logger.js'
import { upsertAdmin } from '#repositories/user.repository.js'
import { hashPassword } from '#utils/password.js'
import {
  parseDisplayName,
  parseEmail,
  parseNewPassword,
} from '#validations/auth.validation.js'

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })

    // Suppress echo of everything typed after the question itself.
    rl._writeToOutput = (text) => {
      if (text.includes(question)) rl.output.write(text)
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    return process.env.ADMIN_PASSWORD ?? ''
  }

  const password = await askHidden('Password: ')
  const confirmation = await askHidden('Confirm password: ')

  if (password !== confirmation) {
    throw new Error('Passwords do not match')
  }

  return password
}

function describe(error) {
  return error.details?.[0]?.message ?? error.message
}

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string', default: 'Administrator' },
  },
})

loadEnvironmentFile()

const environment = getEnvironment()
const logger = createLogger(environment)

let input

try {
  input = {
    email: parseEmail(values.email),
    displayName: parseDisplayName(values.name),
    password: parseNewPassword(await readPassword()),
  }
} catch (error) {
  logger.error(describe(error))
  logger.error('Usage: npm run create-admin -- --email <email> [--name <name>]')
  process.exit(1)
}

await connectDatabase({
  mongodbUri: environment.mongodbUri,
  mongodbDbName: environment.mongodbDbName,
  logger,
})

try {
  const admin = await upsertAdmin({
    email: input.email,
    displayName: input.displayName,
    passwordHash: await hashPassword(input.password),
  })

  logger.info(`Administrator ready: ${admin.email} (${admin.id})`)
} finally {
  await disconnectDatabase()
}
