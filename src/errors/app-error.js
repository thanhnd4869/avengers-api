import { ERROR_CODE } from '../constants/error-code.js'
import { HTTP_STATUS } from '../constants/http-status.js'

/**
 * Base class for errors that are expected during normal operation.
 *
 * An operational error describes a condition the API knows how to report to the
 * client, such as invalid input or a missing resource. Errors that are not
 * instances of this class are treated as programming faults and their details
 * are never exposed.
 *
 * Every operational error carries a stable `code` so that clients can branch on
 * it without depending on the wording of `message`. Subclasses provide a
 * sensible default code that callers may override for a more specific one, for
 * example `GAME_ALREADY_OWNED` instead of the generic `CONFLICT`.
 */
export class AppError extends Error {
  constructor(
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    { code = ERROR_CODE.INTERNAL_ERROR, details } = {},
  ) {
    super(message)

    this.name = new.target.name
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true

    if (details !== undefined) {
      this.details = details
    }

    Error.captureStackTrace(this, new.target)
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', options = {}) {
    super(message, HTTP_STATUS.BAD_REQUEST, {
      code: ERROR_CODE.BAD_REQUEST,
      ...options,
    })
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', options = {}) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, {
      code: ERROR_CODE.VALIDATION_FAILED,
      ...options,
    })
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', options = {}) {
    super(message, HTTP_STATUS.UNAUTHORIZED, {
      code: ERROR_CODE.UNAUTHORIZED,
      ...options,
    })
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', options = {}) {
    super(message, HTTP_STATUS.FORBIDDEN, {
      code: ERROR_CODE.FORBIDDEN,
      ...options,
    })
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', options = {}) {
    super(message, HTTP_STATUS.NOT_FOUND, {
      code: ERROR_CODE.NOT_FOUND,
      ...options,
    })
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', options = {}) {
    super(message, HTTP_STATUS.CONFLICT, {
      code: ERROR_CODE.CONFLICT,
      ...options,
    })
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', options = {}) {
    super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, {
      code: ERROR_CODE.SERVICE_UNAVAILABLE,
      ...options,
    })
  }
}

export function isOperationalError(error) {
  return error instanceof AppError && error.isOperational === true
}
