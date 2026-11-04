import { NotFoundError } from '#errors/app-error.js'
import {
  parseCommentId,
  validateCommentListQuery,
  validateCommentUpdate,
  validateNewComment,
} from '#validations/post-comment.validation.js'
import { toPaginatedResponse } from './pagination.js'

function postNotFound() {
  return new NotFoundError('Post not found')
}

function commentNotFound() {
  return new NotFoundError('Comment not found')
}

/** What the API shows of a comment; `mine` marks the reader's own. */
export function toPublicComment(comment, viewerId) {
  return {
    id: String(comment._id),
    parentId: comment.parentId ? String(comment.parentId) : null,
    authorName: comment.deleted ? null : comment.authorName,
    body: comment.deleted ? null : comment.body,
    createdAt: comment.createdAt,
    edited: Boolean(comment.edited),
    deleted: Boolean(comment.deleted),
    mine: Boolean(
      viewerId && comment.userId && String(comment.userId) === String(viewerId),
    ),
  }
}

/**
 * Comments on blog posts, by signed-in readers, published at once. Readers
 * may edit and delete their own; threads are one level deep.
 */
export function createPostCommentService({
  postCommentRepository,
  postRepository,
  userRepository,
}) {
  async function findPost(slug) {
    const post = await postRepository.findPublishedPostRefBySlug(slug)

    if (!post) throw postNotFound()

    return post
  }

  async function findPostId(slug) {
    return (await findPost(slug))._id
  }

  return {
    /**
     * `meta.total` counts threads, which is what pages are made of;
     * `meta.commentCount` counts every comment, replies included.
     */
    async listComments(slug, query, viewerId = null) {
      const { page, limit } = validateCommentListQuery(query)
      const post = await findPost(slug)
      const { threads, replies, total } =
        await postCommentRepository.findThreads({
          postId: post._id,
          page,
          limit,
        })
      const repliesByThread = Map.groupBy(replies, (reply) =>
        String(reply.parentId),
      )
      const response = toPaginatedResponse(
        threads.map((thread) => ({
          ...toPublicComment(thread, viewerId),
          replies: (repliesByThread.get(String(thread._id)) ?? []).map(
            (reply) => toPublicComment(reply, viewerId),
          ),
        })),
        { page, limit, total },
      )

      return {
        ...response,
        meta: { ...response.meta, commentCount: post.commentCount },
      }
    },

    async createComment(userId, slug, input) {
      const { body, parentId } = validateNewComment(input)
      const postId = await findPostId(slug)
      const user = await userRepository.findUserById(userId)
      const comment = await postCommentRepository.createComment({
        postId,
        parentId,
        userId,
        authorName: user.displayName,
        body,
      })

      if (!comment) {
        throw new NotFoundError('The comment you replied to has been removed.')
      }

      return { data: toPublicComment(comment, userId) }
    },

    async updateComment(userId, slug, commentId, input) {
      const id = parseCommentId(commentId)
      const { body } = validateCommentUpdate(input)
      const postId = await findPostId(slug)
      const comment = await postCommentRepository.updateUserComment({
        commentId: id,
        postId,
        userId,
        body,
      })

      if (!comment) throw commentNotFound()

      return { data: toPublicComment(comment, userId) }
    },

    async deleteComment(userId, slug, commentId) {
      const id = parseCommentId(commentId)
      const postId = await findPostId(slug)

      if (
        !(await postCommentRepository.deleteUserComment({
          commentId: id,
          postId,
          userId,
        }))
      ) {
        throw commentNotFound()
      }
    },
  }
}
