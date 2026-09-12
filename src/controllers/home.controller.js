import { HTTP_STATUS } from '@constants/http-status.js'

export function createHomeController({ homeService }) {
  function getHome(_request, response) {
    response.status(HTTP_STATUS.OK).json({
      success: true,
      ...homeService.getWelcome(),
    })
  }

  return { getHome }
}
