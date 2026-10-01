import { validatePostListQuery } from '@validations/post.validation.js'
import { toPaginatedResponse } from './pagination.js'

// The populated reference is published as `category`, the name clients read.
function toPostListing(post) {
  const { categoryId, ...rest } = post.toJSON()

  return {
    ...rest,
    category: categoryId
      ? { name: categoryId.name, slug: categoryId.slug }
      : null,
  }
}

export function createPostService({ postRepository }) {
  return {
    async listPosts(query) {
      const { page, limit, categorySlug, search } = validatePostListQuery(query)
      const { posts, total } = await postRepository.findPublishedPosts({
        page,
        limit,
        categorySlug,
        search,
      })

      return toPaginatedResponse(posts.map(toPostListing), {
        page,
        limit,
        total,
      })
    },
  }
}
