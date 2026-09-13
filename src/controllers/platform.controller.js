import { HTTP_STATUS } from '@constants/http-status.js'

export function createPlatformController({ platformService }) {
  return {
    async listPlatforms(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await platformService.listPlatforms())
    },
  }
}
