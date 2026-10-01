import { HTTP_STATUS } from '@constants/http-status.js'

export function createSocialLinkController({ socialLinkService }) {
  return {
    async listSocialLinks(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await socialLinkService.listSocialLinks())
    },
  }
}
