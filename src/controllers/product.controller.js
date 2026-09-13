import { HTTP_STATUS } from '@constants/http-status.js'

export function createProductController({ productService }) {
  return {
    async listProducts(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await productService.listProducts(request.query))
    },
  }
}
