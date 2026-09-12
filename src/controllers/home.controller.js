import { API_VERSION } from '../constants/api.js'
import { HTTP_STATUS } from '../constants/http-status.js'

export function getHome(_request, response) {
  response.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Welcome to the Avengers API',
    version: API_VERSION,
  })
}
