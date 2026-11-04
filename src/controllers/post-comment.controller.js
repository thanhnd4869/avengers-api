import { HTTP_STATUS } from '#constants/http-status.js'

export function createPostCommentController({ postCommentService }) {
  return {
    async listComments(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await postCommentService.listComments(
            request.params.slug,
            request.query,
            request.auth?.userId,
          ),
        )
    },

    async createComment(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(
          await postCommentService.createComment(
            request.auth.userId,
            request.params.slug,
            request.body,
          ),
        )
    },

    async updateComment(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await postCommentService.updateComment(
            request.auth.userId,
            request.params.slug,
            request.params.commentId,
            request.body,
          ),
        )
    },

    async deleteComment(request, response) {
      await postCommentService.deleteComment(
        request.auth.userId,
        request.params.slug,
        request.params.commentId,
      )
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },
  }
}
