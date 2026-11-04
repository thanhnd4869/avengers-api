import { NotFoundError } from '#errors/app-error.js'
import {
  validateProductListQuery,
  validateProductReviewsQuery,
  validateRelatedProductsQuery,
} from '#validations/product.validation.js'
import { toPaginatedResponse } from './pagination.js'
import { toPublicReview } from './review.service.js'

function productNotFound() {
  return new NotFoundError('Product not found')
}

export function createProductService({ productRepository }) {
  return {
    async listProducts(query) {
      const { page, limit, ...filters } = validateProductListQuery(query)
      const { products, total, priceRange } =
        await productRepository.findPublishedProducts({
          page,
          limit,
          ...filters,
        })
      const response = toPaginatedResponse(products, { page, limit, total })

      response.meta.priceRange = priceRange

      return response
    },

    async getProduct(slug) {
      const product = await productRepository.findPublishedProductBySlug(slug)

      if (!product) {
        throw productNotFound()
      }

      return { data: product }
    },

    async listRelatedProducts(slug, query) {
      const { limit } = validateRelatedProductsQuery(query)
      const products = await productRepository.findRelatedProducts({
        slug,
        limit,
      })

      if (!products) {
        throw productNotFound()
      }

      return { data: products }
    },

    async listReviews(slug, query, viewerId = null) {
      const { page, limit } = validateProductReviewsQuery(query)
      const productId = await productRepository.findProductIdBySlug(slug)

      if (!productId) {
        throw productNotFound()
      }

      const { reviews, total } = await productRepository.findProductReviews({
        productId,
        page,
        limit,
      })

      return toPaginatedResponse(
        reviews.map((review) => toPublicReview(review, viewerId)),
        { page, limit, total },
      )
    },

    async listCategories() {
      return { data: await productRepository.findProductCategories() }
    },
  }
}
