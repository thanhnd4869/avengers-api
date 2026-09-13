import { validatePostListQuery } from '@validations/post.validation.js'
import { toPaginatedResponse } from './pagination.js'

export function createPostService({ postRepository }) {
  return {
    async listPosts(query) {
      const { page, limit, categorySlug } = validatePostListQuery(query)
      const { posts, total } = await postRepository.findPublishedPosts({
        page,
        limit,
        categorySlug,
      })

      return toPaginatedResponse(posts, { page, limit, total })
    },
  }
}
