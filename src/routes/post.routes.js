import { Router } from 'express'

export function createPostRouter({
  postController,
  postCommentController,
  auth,
  commentRateLimit,
}) {
  const router = Router()

  router.get('/', postController.listPosts)
  router.get('/:slug', postController.getPost)
  // Signed-in readers see which comments are theirs.
  router.get(
    '/:slug/comments',
    auth.optionalAuth,
    postCommentController.listComments,
  )
  router.post(
    '/:slug/comments',
    commentRateLimit,
    auth.authenticate,
    postCommentController.createComment,
  )
  router.patch(
    '/:slug/comments/:commentId',
    commentRateLimit,
    auth.authenticate,
    postCommentController.updateComment,
  )
  router.delete(
    '/:slug/comments/:commentId',
    auth.authenticate,
    postCommentController.deleteComment,
  )

  return router
}
