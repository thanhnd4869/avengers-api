import { HTTP_STATUS } from '@constants/http-status.js'

export function createBannerController({ bannerService }) {
  return {
    async listBanners(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await bannerService.listBanners(request.query))
    },
  }
}
