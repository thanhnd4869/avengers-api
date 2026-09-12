import { ERROR_CODE } from '@constants/error-code.js'
import { HTTP_STATUS } from '@constants/http-status.js'
import { isOperationalError } from '@errors/app-error.js'

/**
 * Operational errors keep their status and message; anything else becomes a
 * generic 500 so internal details never leak, while still being logged in full.
 */
export function createErrorHandlerMiddleware({ exposeStack, logger }) {
  return function errorHandlerMiddleware(error, request, response, next) {
    if (response.headersSent) {
      return next(error)
    }

    const operational = isOperationalError(error)
    const statusCode = operational
      ? error.statusCode
      : HTTP_STATUS.INTERNAL_SERVER_ERROR

    const log = request.log ?? logger

    if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      log?.error({ err: error, statusCode }, 'Request failed')
    } else {
      log?.warn({ err: error, statusCode }, 'Request rejected')
    }

    const body = {
      success: false,
      code: operational ? error.code : ERROR_CODE.INTERNAL_ERROR,
      message: operational ? error.message : 'Internal server error',
    }

    if (operational && error.details !== undefined) {
      body.details = error.details
    }

    if (request.id !== undefined) {
      body.requestId = request.id
    }

    if (exposeStack && error instanceof Error) {
      body.stack = error.stack
    }

    response.status(statusCode).json(body)
  }
}
