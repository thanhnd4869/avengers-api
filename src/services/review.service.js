import { ERROR_CODE } from '#constants/error-code.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '#errors/app-error.js'
import { validateReviewBody } from '#validations/review.validation.js'

function productNotFound() {
  return new NotFoundError('Product not found')
}

function reviewNotFound() {
  return new NotFoundError('You have not reviewed this game.')
}

/** What the API shows of a review; `mine` marks the reader's own. */
export function toPublicReview(review, viewerId) {
  return {
    id: String(review._id),
    authorName: review.authorName,
    rating: review.rating,
    content: review.content,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    verifiedPurchase: Boolean(review.userId),
    mine: Boolean(
      viewerId && review.userId && String(review.userId) === String(viewerId),
    ),
  }
}

/**
 * Reviews written on the site. Only a shopper with a paid order for the game
 * may write one, and only one: the database refuses a second, so a double
 * submit or two tabs end with one review and a `REVIEW_EXISTS` error.
 */
export function createReviewService({
  reviewRepository,
  productRepository,
  userRepository,
}) {
  async function findProductId(slug) {
    const productId = await productRepository.findProductIdBySlug(slug)

    if (!productId) throw productNotFound()

    return productId
  }

  return {
    /** Whether the reader may review the game, and their review if any. */
    async getMyReview(userId, slug) {
      const productId = await findProductId(slug)
      const [review, purchased] = await Promise.all([
        reviewRepository.findUserReview(userId, productId),
        reviewRepository.hasPurchasedProduct(userId, productId),
      ])

      return {
        data: {
          canReview: purchased && !review,
          purchased,
          review: review ? toPublicReview(review, userId) : null,
        },
      }
    },

    async createReview(userId, slug, body) {
      const { rating, content } = validateReviewBody(body)
      const productId = await findProductId(slug)

      if (!(await reviewRepository.hasPurchasedProduct(userId, productId))) {
        throw new ForbiddenError(
          'Only customers who bought this game can review it.',
          { code: ERROR_CODE.REVIEW_NOT_ALLOWED },
        )
      }

      const user = await userRepository.findUserById(userId)

      try {
        const review = await reviewRepository.createReview({
          productId,
          userId,
          authorName: user.displayName,
          rating,
          content,
        })

        return { data: toPublicReview(review, userId) }
      } catch (error) {
        if (reviewRepository.isDuplicateReviewError(error)) {
          throw new ConflictError(
            'You have already reviewed this game. You can edit your review instead.',
            { code: ERROR_CODE.REVIEW_EXISTS },
          )
        }

        throw error
      }
    },

    async updateReview(userId, slug, body) {
      const { rating, content } = validateReviewBody(body)
      const productId = await findProductId(slug)
      const review = await reviewRepository.updateUserReview({
        userId,
        productId,
        rating,
        content,
      })

      if (!review) throw reviewNotFound()

      return { data: toPublicReview(review, userId) }
    },

    async deleteReview(userId, slug) {
      const productId = await findProductId(slug)

      if (!(await reviewRepository.deleteUserReview({ userId, productId }))) {
        throw reviewNotFound()
      }
    },
  }
}
