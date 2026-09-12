import { loadEnvFile } from 'node:process'

const ENVIRONMENTS = Object.freeze(['development', 'production'])

export function loadEnvironmentFile() {
  try {
    loadEnvFile()
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

function readString(source, key, fallback) {
  const value = source[key]

  return value === undefined || value.trim() === '' ? fallback : value.trim()
}

function readPort(source) {
  const port = Number(readString(source, 'PORT', '8000'))

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('PORT must be an integer between 1 and 65535')
  }

  return port
}

function readNodeEnv(source) {
  const nodeEnv = readString(source, 'NODE_ENV', 'development')

  if (!ENVIRONMENTS.includes(nodeEnv)) {
    throw new RangeError(`NODE_ENV must be one of ${ENVIRONMENTS.join(', ')}`)
  }

  return nodeEnv
}

function readOrigins(source) {
  const raw = readString(source, 'CORS_ORIGINS', '')

  if (raw === '') return []

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '')
}

function readMongodbUri(source) {
  const uri = readString(source, 'MONGODB_URI', '')

  if (uri === '') {
    throw new RangeError('MONGODB_URI is required')
  }

  return uri
}

export function getEnvironment(source = process.env) {
  const nodeEnv = readNodeEnv(source)
  const isProduction = nodeEnv === 'production'

  return Object.freeze({
    nodeEnv,
    isProduction,
    hostname: readString(source, 'HOST', 'localhost'),
    port: readPort(source),
    mongodbUri: readMongodbUri(source),
    mongodbDbName: readString(source, 'MONGODB_DB_NAME', 'avengers'),
    corsOrigins: Object.freeze(readOrigins(source)),
    logLevel: readString(source, 'LOG_LEVEL', isProduction ? 'info' : 'debug'),
    exposeStack: !isProduction,
  })
}
