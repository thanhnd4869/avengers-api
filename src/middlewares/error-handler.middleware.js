export function errorHandlerMiddleware(error, _request, response, _next) {
  console.error(error)

  response.status(500).json({
    success: false,
    message: 'Internal server error',
  })
}
