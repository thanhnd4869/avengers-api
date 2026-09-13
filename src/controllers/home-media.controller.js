import { HTTP_STATUS } from '@constants/http-status.js'

export function createHomeMediaController({ homeMediaService }) {
  return {
    async getHomeMedia(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await homeMediaService.getHomeMedia())
    },
  }
}
