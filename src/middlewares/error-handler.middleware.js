import { ERROR_CODE } from '@constants/error-code.js'
import { HTTP_STATUS } from '@constants/http-status.js'
import { isOperationalError, ValidationError } from '@errors/app-error.js'

// body-parser rejects unreadable payloads before any handler runs, so those
// failures would otherwise be reported as internal faults.
const BODY_PARSER_MESSAGE = Object.freeze({
  'entity.parse.failed': 'Request body must be valid JSON.',
  'entity.too.large': 'Request body is too large.',
  'encoding.unsupported': 'Request body encoding is not supported.',
})

function toOperationalError(error) {
  const message = BODY_PARSER_MESSAGE[error?.type]

  return message === undefined ? error : new ValidationError(message)
}

/**
 * Operational errors keep their status and message; anything else becomes a
 * generic 500 so internal details never leak, while still being logged in full.
 */
export function createErrorHandlerMiddleware({ exposeStack, logger }) {
  return function errorHandlerMiddleware(
    originalError,
    request,
    response,
    next,
  ) {
    if (response.headersSent) {
      return next(originalError)
    }

    const error = toOperationalError(originalError)
    const operational = isOperationalError(error)
    const statusCode = operational
      ? error.statusCode
      : HTTP_STATUS.INTERNAL_SERVER_ERROR

    const log = request.log ?? logger

    if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      log?.error({ err: originalError, statusCode }, 'Request failed')
    } else {
      log?.warn({ err: originalError, statusCode }, 'Request rejected')
    }

    const body = {
      error: {
        code: operational ? error.code : ERROR_CODE.INTERNAL_ERROR,
        message: operational ? error.message : 'Internal server error',
      },
    }

    if (operational && error.details !== undefined) {
      body.error.details = error.details
    }

    if (request.id !== undefined) {
      body.error.requestId = request.id
    }

    if (exposeStack && originalError instanceof Error) {
      body.error.stack = originalError.stack
    }

    response.status(statusCode).json(body)
  }
}
