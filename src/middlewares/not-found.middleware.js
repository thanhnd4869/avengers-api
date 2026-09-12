import { NotFoundError } from '../errors/app-error.js'

// Routed through the error handler so that every response has one shape.
export function notFoundMiddleware(request, _response, next) {
  next(
    new NotFoundError(
      `Route ${request.method} ${request.originalUrl} not found`,
    ),
  )
}
