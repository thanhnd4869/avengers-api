import { NotFoundError } from '#errors/app-error.js'
import { validatePostListQuery } from '#validations/post.validation.js'
import { toPaginatedResponse } from './pagination.js'

const RELATED_LIMIT = 2

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

    /** One published post with its body and a few related posts. */
    async getPost(slug) {
      const post = await postRepository.findPublishedPostBySlug(slug)

      if (!post) throw new NotFoundError('Post not found')

      const related = await postRepository.findRelatedPosts({
        postId: post._id,
        categoryId: post.categoryId?._id,
        limit: RELATED_LIMIT,
      })

      return {
        data: { ...toPostListing(post), related: related.map(toPostListing) },
      }
    },
  }
}
