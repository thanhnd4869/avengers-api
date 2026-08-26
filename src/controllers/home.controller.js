export function getHome(_request, response) {
  response.status(200).json({
    success: true,
    message: 'Welcome to the Avengers API',
  })
}
