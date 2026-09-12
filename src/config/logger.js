import pino from 'pino'

export function createLogger({ logLevel, isProduction }) {
  return pino({
    level: logLevel,
    ...(isProduction
      ? {}
      : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'password',
        '*.password',
        // A connection string embeds the database password in plain text.
        'mongodbUri',
        '*.mongodbUri',
        'uri',
        '*.uri',
      ],
      censor: '[REDACTED]',
    },
  })
}
