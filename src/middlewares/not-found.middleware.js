import { NotFoundError } from '../errors/app-error.js'

/**
 * Converts an unmatched route into a NotFoundError so that every response is
 * produced by the single error handler.
 */
export function notFoundMiddleware(request, _response, next) {
  next(
    new NotFoundError(
      `Route ${request.method} ${request.originalUrl} not found`,
    ),
  )
}
