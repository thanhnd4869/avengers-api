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

function readRedisUrl(source) {
  const url = readString(source, 'REDIS_URL', 'redis://localhost:6379')

  if (!/^rediss?:\/\//.test(url)) {
    throw new RangeError('REDIS_URL must start with redis:// or rediss://')
  }

  return url
}

// HS256 is only as strong as its key; RFC 7518 requires at least 256 bits.
const JWT_SECRET_MIN_BYTES = 32

function readJwtSecret(source) {
  const secret = readString(source, 'JWT_SECRET', '')

  if (Buffer.byteLength(secret, 'utf8') < JWT_SECRET_MIN_BYTES) {
    throw new RangeError(
      `JWT_SECRET is required and must be at least ${JWT_SECRET_MIN_BYTES} bytes`,
    )
  }

  return secret
}

function readPositiveInteger(source, key, fallback) {
  const value = Number(readString(source, key, String(fallback)))

  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${key} must be a positive integer`)
  }

  return value
}

function readUrl(source, key, fallback) {
  const raw = readString(source, key, fallback)

  try {
    // Links are built by appending a path, so a trailing slash would double up.
    return new URL(raw).href.replace(/\/$/, '')
  } catch {
    throw new RangeError(`${key} must be an absolute URL`)
  }
}

function readAppUrl(source) {
  return readUrl(source, 'APP_URL', 'http://localhost:3000')
}

/**
 * Sign-in with Google or Facebook is offered only for providers whose id and
 * secret are both set.
 */
function readOAuth(source) {
  const provider = (idKey, secretKey) => {
    const clientId = readString(source, idKey, '')
    const clientSecret = readString(source, secretKey, '')

    return clientId && clientSecret
      ? Object.freeze({ clientId, clientSecret })
      : null
  }

  return Object.freeze({
    // Where the providers send the visitor back: the API's own public origin.
    apiUrl: readUrl(source, 'API_URL', `http://localhost:${readPort(source)}`),
    google: provider('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    facebook: provider('FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'),
  })
}

/**
 * Without SMTP settings the mailer only logs each message, which is enough to
 * develop against. Production refuses to start, since nobody could verify an
 * email address or reset a password.
 */
function readSmtp(source, isProduction) {
  const host = readString(source, 'SMTP_HOST', '')

  if (host === '') {
    if (isProduction) {
      throw new RangeError('SMTP_HOST is required in production')
    }

    return null
  }

  const port = readPositiveInteger(source, 'SMTP_PORT', 587)

  return Object.freeze({
    host,
    port,
    // Port 465 speaks TLS from the first byte; others upgrade with STARTTLS.
    secure: port === 465,
    user: readString(source, 'SMTP_USER', ''),
    pass: readString(source, 'SMTP_PASS', ''),
  })
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
    redisUrl: readRedisUrl(source),
    // Every key starts with this, so several apps or environments can share
    // one Redis without stepping on each other.
    redisKeyPrefix: readString(source, 'REDIS_KEY_PREFIX', 'avengers:'),
    corsOrigins: Object.freeze(readOrigins(source)),
    logLevel: readString(source, 'LOG_LEVEL', isProduction ? 'info' : 'debug'),
    exposeStack: !isProduction,
    jwtSecret: readJwtSecret(source),
    accessTokenTtlMinutes: readPositiveInteger(
      source,
      'ACCESS_TOKEN_TTL_MINUTES',
      15,
    ),
    refreshTokenTtlDays: readPositiveInteger(
      source,
      'REFRESH_TOKEN_TTL_DAYS',
      30,
    ),
    appUrl: readAppUrl(source),
    oauth: readOAuth(source),
    smtp: readSmtp(source, isProduction),
    mailFrom: readString(source, 'MAIL_FROM', 'Avengers <no-reply@localhost>'),
  })
}
