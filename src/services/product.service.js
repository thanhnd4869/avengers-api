import { validateProductListQuery } from '@validations/product.validation.js'
import { toPaginatedResponse } from './pagination.js'

export function createProductService({ productRepository }) {
  return {
    async listProducts(query) {
      const { page, limit, sort } = validateProductListQuery(query)
      const { products, total } = await productRepository.findPublishedProducts(
        { page, limit, sort },
      )

      return toPaginatedResponse(products, { page, limit, total })
    },
  }
}
