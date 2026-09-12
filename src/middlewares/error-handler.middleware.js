import { ERROR_CODE } from '../constants/error-code.js'
import { HTTP_STATUS } from '../constants/http-status.js'
import { isOperationalError } from '../errors/app-error.js'

/**
 * Converts any error reaching the end of the pipeline into a JSON response.
 *
 * Operational errors keep their status code and message. Any other error is
 * reported as a generic 500 so that internal details are never leaked, while
 * the full error is still logged for diagnosis.
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

    // Lets a user quote a single value that points straight at the server logs.
    if (request.id !== undefined) {
      body.requestId = request.id
    }

    if (exposeStack && error instanceof Error) {
      body.stack = error.stack
    }

    response.status(statusCode).json(body)
  }
}
