import { HTTP_STATUS } from '@constants/http-status.js'

export function createHomeContentController({ homeContentService }) {
  return {
    async getBanners(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await homeContentService.getBanners(request.query))
    },
    async getPlatforms(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await homeContentService.getPlatforms())
    },
    async getProducts(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await homeContentService.getProducts(request.query))
    },
    async getPosts(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await homeContentService.getPosts(request.query))
    },
    async getPostCategories(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await homeContentService.getPostCategories())
    },
    async submitContact(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await homeContentService.submitContact(request.body))
    },
  }
}
