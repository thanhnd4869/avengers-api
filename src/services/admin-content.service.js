import { ERROR_CODE } from '#constants/error-code.js'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '#errors/app-error.js'
import { validateId } from '#validations/admin-catalogue.validation.js'
import {
  validateAdminCommentListQuery,
  validateAdminPostListQuery,
  validateBannerBody,
  validatePostBody,
} from '#validations/admin-content.validation.js'
import { toPaginatedResponse } from './pagination.js'

function toAdminBanner(banner) {
  return {
    id: String(banner._id),
    title: banner.title,
    excerpt: banner.excerpt,
    image: banner.image,
    linkUrl: banner.linkUrl,
    linkLabel: banner.linkLabel,
    sortOrder: banner.sortOrder,
    published: banner.published,
    updatedAt: banner.updatedAt,
  }
}

function toAdminPost(post, { withContent = false } = {}) {
  return {
    id: String(post._id),
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    ...(withContent ? { content: post.content } : {}),
    image: post.image,
    categoryId: String(post.categoryId),
    publishedAt: post.publishedAt,
    commentCount: post.commentCount,
    published: post.published,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  }
}

function toAdminComment(comment, post) {
  return {
    id: String(comment._id),
    post: post
      ? { id: String(post._id), title: post.title, slug: post.slug }
      : null,
    isReply: Boolean(comment.parentId),
    userId: comment.userId ? String(comment.userId) : null,
    authorName: comment.authorName,
    body: comment.body,
    edited: Boolean(comment.edited),
    createdAt: comment.createdAt,
  }
}

function slugTaken() {
  return new ConflictError('Another post already uses this slug.', {
    code: ERROR_CODE.SLUG_TAKEN,
    details: [{ field: 'slug', message: 'This slug is already in use.' }],
  })
}

/**
 * The shop's editorial content: home banners, blog posts and the comments
 * readers leave on them.
 */
export function createAdminContentService({
  adminContentRepository: repository,
  logger,
}) {
  async function checkCategory(categoryId) {
    if (categoryId && !(await repository.findPostCategoryById(categoryId))) {
      throw new ValidationError('That category does not exist.', {
        details: [
          { field: 'categoryId', message: 'That category does not exist.' },
        ],
      })
    }
  }

  async function savePost(write) {
    try {
      const post = await write()

      if (!post) throw new NotFoundError('Post not found.')

      return { data: toAdminPost(post, { withContent: true }) }
    } catch (error) {
      if (repository.isDuplicateKeyError(error)) throw slugTaken()
      throw error
    }
  }

  return {
    async listBanners() {
      return { data: (await repository.findBanners()).map(toAdminBanner) }
    },

    async createBanner(body) {
      const banner = await repository.createBanner(validateBannerBody(body))

      return { data: toAdminBanner(banner) }
    },

    async updateBanner(rawId, body) {
      const id = validateId(rawId)
      const banner = await repository.updateBanner(
        id,
        validateBannerBody(body, { partial: true }),
      )

      if (!banner) throw new NotFoundError('Banner not found.')

      return { data: toAdminBanner(banner) }
    },

    async deleteBanner(rawId) {
      if (!(await repository.deleteBanner(validateId(rawId)))) {
        throw new NotFoundError('Banner not found.')
      }
    },

    async listPosts(query) {
      const filters = validateAdminPostListQuery(query)
      const { posts, total } = await repository.findPosts(filters)

      return toPaginatedResponse(
        posts.map((post) => toAdminPost(post)),
        { page: filters.page, limit: filters.limit, total },
      )
    },

    async getPost(rawId) {
      const post = await repository.findPostById(validateId(rawId))

      if (!post) throw new NotFoundError('Post not found.')

      return { data: toAdminPost(post, { withContent: true }) }
    },

    /** New posts start hidden, so they can be finished before going live. */
    async createPost(body) {
      const input = validatePostBody(body)

      await checkCategory(input.categoryId)

      return savePost(() =>
        repository.createPost({ published: false, commentCount: 0, ...input }),
      )
    },

    async updatePost(rawId, body) {
      const id = validateId(rawId)
      const changes = validatePostBody(body, { partial: true })

      await checkCategory(changes.categoryId)

      return savePost(() => repository.updatePost(id, changes))
    },

    async deletePost(rawId, { adminId }) {
      const id = validateId(rawId)

      if (!(await repository.deletePost(id))) {
        throw new NotFoundError('Post not found.')
      }

      logger.info({ postId: id, adminId }, 'Admin deleted a post')
    },

    async listPostCategories() {
      const categories = await repository.findPostCategories()

      return {
        data: categories.map((category) => ({
          id: String(category._id),
          name: category.name,
          slug: category.slug,
        })),
      }
    },

    async listComments(query) {
      const filters = validateAdminCommentListQuery(query)
      const { comments, total } = await repository.findComments(filters)
      const posts = comments.length
        ? await repository.findPostTitles([
            ...new Set(comments.map((comment) => String(comment.postId))),
          ])
        : new Map()

      return toPaginatedResponse(
        comments.map((comment) =>
          toAdminComment(comment, posts.get(String(comment.postId))),
        ),
        { page: filters.page, limit: filters.limit, total },
      )
    },

    /**
     * Takes a comment down. A first comment with replies stays as a
     * "deleted" placeholder, exactly as when its author removes it.
     */
    async deleteComment(rawId, { adminId }) {
      const id = validateId(rawId)
      const postId = await repository.deleteCommentById(id)

      if (!postId) throw new NotFoundError('Comment not found.')

      logger.info(
        { commentId: id, postId: String(postId), adminId },
        'Admin removed a comment',
      )
    },
  }
}
