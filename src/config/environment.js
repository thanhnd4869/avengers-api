import { loadEnvFile } from 'node:process'

export function loadEnvironmentFile() {
  try {
    loadEnvFile()
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

export function getEnvironment(source = process.env) {
  const hostname = source.HOST || 'localhost'
  const port = Number(source.PORT || '8000')

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('PORT must be an integer between 1 and 65535')
  }

  return Object.freeze({ hostname, port })
}
