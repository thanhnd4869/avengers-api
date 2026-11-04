import { HTTP_STATUS } from '#constants/http-status.js'

export function createPageController({ pageService }) {
  return {
    async getPage(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await pageService.getPage(request.params.slug))
    },
  }
}
