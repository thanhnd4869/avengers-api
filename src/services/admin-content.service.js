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
import {
  validateGalleryBody,
  validateMediaBody,
  validatePageBody,
  validatePageSlug,
  validateSocialLinkBody,
  validateTaxonomyBody,
} from '#validations/admin-cms.validation.js'
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

function toAdminPage(page) {
  return {
    slug: page.slug,
    title: page.title,
    summary: page.summary,
    sections: page.sections,
    published: page.published,
    updatedAt: page.updatedAt,
  }
}

function toAdminGallery(gallery) {
  return {
    id: String(gallery._id),
    slug: gallery.slug,
    title: gallery.title,
    cover: gallery.cover,
    images: gallery.images,
    sortOrder: gallery.sortOrder,
    published: gallery.published,
    updatedAt: gallery.updatedAt,
  }
}

function toAdminMedia(media) {
  return {
    id: String(media._id),
    type: media.type,
    title: media.title,
    image: media.image,
    url: media.url,
    sortOrder: media.sortOrder,
    published: media.published,
    updatedAt: media.updatedAt,
  }
}

function toAdminSocialLink(link) {
  return {
    id: String(link._id),
    network: link.network,
    label: link.label,
    url: link.url,
    sortOrder: link.sortOrder,
    published: link.published !== false,
    updatedAt: link.updatedAt,
  }
}

function toAdminPostCategory(category) {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
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
  adminUploadService,
  logger,
}) {
  /**
   * Runs a write that answers the document after it, and lets go of the
   * uploads the document showed before but no longer does.
   */
  async function replacing(findBefore, write) {
    const before = await findBefore()
    const after = await write()

    if (after) await adminUploadService.releaseReplaced(before, after)

    return after
  }

  /** Runs a delete that answers whether it removed the document. */
  async function removing(findBefore, remove) {
    const before = await findBefore()
    const removed = await remove()

    if (removed) await adminUploadService.releaseReplaced(before, null)

    return removed
  }

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

  async function saveCmsItem(write, present, resourceName) {
    try {
      const item = await write()
      if (!item) throw new NotFoundError(`${resourceName} not found.`)
      return { data: present(item) }
    } catch (error) {
      if (repository.isDuplicateKeyError(error)) {
        throw new ConflictError(
          `Another ${resourceName.toLowerCase()} already uses that slug.`,
          {
            code: ERROR_CODE.SLUG_TAKEN,
            details: [
              { field: 'slug', message: 'This slug is already in use.' },
            ],
          },
        )
      }
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
      const changes = validateBannerBody(body, { partial: true })
      const banner = await replacing(
        () => repository.findBannerById(id),
        () => repository.updateBanner(id, changes),
      )

      if (!banner) throw new NotFoundError('Banner not found.')

      return { data: toAdminBanner(banner) }
    },

    async deleteBanner(rawId) {
      const id = validateId(rawId)

      if (
        !(await removing(
          () => repository.findBannerById(id),
          () => repository.deleteBanner(id),
        ))
      ) {
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

      return savePost(() =>
        replacing(
          () => repository.findPostById(id),
          () => repository.updatePost(id, changes),
        ),
      )
    },

    async deletePost(rawId, { adminId }) {
      const id = validateId(rawId)

      if (
        !(await removing(
          () => repository.findPostById(id),
          () => repository.deletePost(id),
        ))
      ) {
        throw new NotFoundError('Post not found.')
      }

      logger.info({ postId: id, adminId }, 'Admin deleted a post')
    },

    async listPostCategories() {
      const categories = await repository.findPostCategories()

      return { data: categories.map(toAdminPostCategory) }
    },

    async createPostCategory(body) {
      const input = validateTaxonomyBody(body)
      if (input.slug === 'all') {
        throw new ValidationError('The "all" slug is reserved.', {
          details: [{ field: 'slug', message: 'Choose a different slug.' }],
        })
      }
      try {
        const category = await repository.createPostCategory(input)
        return { data: toAdminPostCategory(category) }
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) {
          throw new ConflictError(
            'Another blog category already uses that slug.',
            {
              code: ERROR_CODE.SLUG_TAKEN,
              details: [
                { field: 'slug', message: 'This slug is already in use.' },
              ],
            },
          )
        }
        throw error
      }
    },

    async updatePostCategory(rawId, body) {
      const id = validateId(rawId)
      const changes = validateTaxonomyBody(body, { partial: true })
      if (changes.slug === 'all') {
        throw new ValidationError('The "all" slug is reserved.', {
          details: [{ field: 'slug', message: 'Choose a different slug.' }],
        })
      }
      try {
        const category = await repository.updatePostCategory(id, changes)
        if (!category) throw new NotFoundError('Blog category not found.')
        return { data: toAdminPostCategory(category) }
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) {
          throw new ConflictError(
            'Another blog category already uses that slug.',
            {
              code: ERROR_CODE.SLUG_TAKEN,
              details: [
                { field: 'slug', message: 'This slug is already in use.' },
              ],
            },
          )
        }
        throw error
      }
    },

    async deletePostCategory(rawId) {
      const id = validateId(rawId)
      if (!(await repository.findPostCategoryById(id))) {
        throw new NotFoundError('Blog category not found.')
      }
      if (await repository.countPostsForCategory(id)) {
        throw new ConflictError(
          'This category is used by blog posts. Move those posts before deleting it.',
        )
      }
      if (!(await repository.deletePostCategory(id))) {
        throw new NotFoundError('Blog category not found.')
      }
    },

    async listPages() {
      return { data: (await repository.findPages()).map(toAdminPage) }
    },

    async updatePage(rawSlug, body) {
      const slug = validatePageSlug(rawSlug)
      const page = await repository.updatePageBySlug(
        slug,
        validatePageBody(body, { partial: true }),
      )
      if (!page) throw new NotFoundError('Page not found.')
      return { data: toAdminPage(page) }
    },

    async listGalleries() {
      return { data: (await repository.findGalleries()).map(toAdminGallery) }
    },

    async createGallery(body) {
      const input = validateGalleryBody(body)
      return saveCmsItem(
        () =>
          repository.createGallery({
            ...input,
            published: input.published ?? false,
          }),
        toAdminGallery,
        'Gallery',
      )
    },

    async updateGallery(rawId, body) {
      const id = validateId(rawId)
      const changes = validateGalleryBody(body, { partial: true })
      return saveCmsItem(
        () =>
          replacing(
            () => repository.findGalleryById(id),
            () => repository.updateGallery(id, changes),
          ),
        toAdminGallery,
        'Gallery',
      )
    },

    async deleteGallery(rawId) {
      const id = validateId(rawId)

      if (
        !(await removing(
          () => repository.findGalleryById(id),
          () => repository.deleteGallery(id),
        ))
      ) {
        throw new NotFoundError('Gallery not found.')
      }
    },

    async listMedia() {
      return { data: (await repository.findMedia()).map(toAdminMedia) }
    },

    async createMedia(body) {
      const input = validateMediaBody(body)
      const media = await repository.createMedia({
        ...input,
        published: input.published ?? false,
      })
      return { data: toAdminMedia(media) }
    },

    async updateMedia(rawId, body) {
      const id = validateId(rawId)
      const changes = validateMediaBody(body, { partial: true })
      const media = await replacing(
        () => repository.findMediaById(id),
        () => repository.updateMedia(id, changes),
      )
      if (!media) throw new NotFoundError('Media item not found.')
      return { data: toAdminMedia(media) }
    },

    async deleteMedia(rawId) {
      const id = validateId(rawId)

      if (
        !(await removing(
          () => repository.findMediaById(id),
          () => repository.deleteMedia(id),
        ))
      ) {
        throw new NotFoundError('Media item not found.')
      }
    },

    async listSocialLinks() {
      return {
        data: (await repository.findSocialLinks()).map(toAdminSocialLink),
      }
    },

    async createSocialLink(body) {
      try {
        const input = validateSocialLinkBody(body)
        const link = await repository.createSocialLink({
          ...input,
          published: input.published ?? false,
        })
        return { data: toAdminSocialLink(link) }
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) {
          throw new ConflictError('That social network already has a link.', {
            details: [
              { field: 'network', message: 'This network is already in use.' },
            ],
          })
        }
        throw error
      }
    },

    async updateSocialLink(rawId, body) {
      const id = validateId(rawId)
      try {
        const link = await repository.updateSocialLink(
          id,
          validateSocialLinkBody(body, { partial: true }),
        )
        if (!link) throw new NotFoundError('Social link not found.')
        return { data: toAdminSocialLink(link) }
      } catch (error) {
        if (repository.isDuplicateKeyError(error)) {
          throw new ConflictError('That social network already has a link.', {
            details: [
              { field: 'network', message: 'This network is already in use.' },
            ],
          })
        }
        throw error
      }
    },

    async deleteSocialLink(rawId) {
      if (!(await repository.deleteSocialLink(validateId(rawId)))) {
        throw new NotFoundError('Social link not found.')
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
