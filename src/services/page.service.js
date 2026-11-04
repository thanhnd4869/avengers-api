import { NotFoundError } from '#errors/app-error.js'

export function createPageService({ pageRepository }) {
  return {
    async getPage(slug) {
      const page = await pageRepository.findPublishedPageBySlug(slug)

      if (!page) throw new NotFoundError('Page not found')

      return { data: page }
    },
  }
}
