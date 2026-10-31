import { HTTP_STATUS } from '#constants/http-status.js'

export function createProductController({ productService }) {
  return {
    async listProducts(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await productService.listProducts(request.query))
    },

    async getProduct(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await productService.getProduct(request.params.slug))
    },

    async listRelatedProducts(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await productService.listRelatedProducts(
            request.params.slug,
            request.query,
          ),
        )
    },

    async listReviews(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await productService.listReviews(request.params.slug, request.query),
        )
    },

    async listCategories(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await productService.listCategories())
    },
  }
}
