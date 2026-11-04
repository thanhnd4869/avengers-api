import { HTTP_STATUS } from '#constants/http-status.js'

export function createReviewController({ reviewService }) {
  return {
    async getMyReview(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await reviewService.getMyReview(
            request.auth.userId,
            request.params.slug,
          ),
        )
    },

    async createReview(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(
          await reviewService.createReview(
            request.auth.userId,
            request.params.slug,
            request.body,
          ),
        )
    },

    async updateReview(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await reviewService.updateReview(
            request.auth.userId,
            request.params.slug,
            request.body,
          ),
        )
    },

    async deleteReview(request, response) {
      await reviewService.deleteReview(request.auth.userId, request.params.slug)
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },
  }
}
