import {
  validateBannerQuery,
  validateContactBody,
  validatePostQuery,
  validateProductQuery,
} from '@validations/home-content.validation.js'

function paginated(data, page, limit, total) {
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export function createHomeContentService({ homeContentRepository }) {
  return {
    async getBanners(query) {
      const { limit } = validateBannerQuery(query)
      return { data: await homeContentRepository.findBanners(limit) }
    },
    async getPlatforms() {
      return { data: await homeContentRepository.findPlatforms() }
    },
    async getProducts(query) {
      const options = validateProductQuery(query)
      const { data, total } = await homeContentRepository.findProducts(options)
      return paginated(data, options.page, options.limit, total)
    },
    async getPosts(query) {
      const options = validatePostQuery(query)
      const { data, total } = await homeContentRepository.findPosts(options)
      return paginated(data, options.page, options.limit, total)
    },
    async getPostCategories() {
      return { data: await homeContentRepository.findPostCategories() }
    },
    async submitContact(body) {
      await homeContentRepository.createContactMessage(
        validateContactBody(body),
      )
      return {
        data: { success: true, message: 'Thank you, we will reply shortly.' },
      }
    },
  }
}
