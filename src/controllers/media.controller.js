import { HTTP_STATUS } from '@constants/http-status.js'

export function createMediaController({ mediaService }) {
  return {
    async listMedia(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await mediaService.listMedia(request.query))
    },
  }
}
