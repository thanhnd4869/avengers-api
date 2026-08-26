export function notFoundMiddleware(request, response) {
  response.status(404).json({
    success: false,
    message: `Route ${request.method} ${request.originalUrl} not found`,
  })
}
