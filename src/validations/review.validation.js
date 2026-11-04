import { fieldError } from './query.validation.js'

export const REVIEW_MIN_LENGTH = 10
export const REVIEW_MAX_LENGTH = 2000

export function validateReviewBody(body = {}) {
  const { rating } = body
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw fieldError('rating', 'Choose a rating from 1 to 5 stars.')
  }

  if (
    content.length < REVIEW_MIN_LENGTH ||
    content.length > REVIEW_MAX_LENGTH
  ) {
    throw fieldError(
      'content',
      `Your review must be between ${REVIEW_MIN_LENGTH} and ${REVIEW_MAX_LENGTH} characters.`,
    )
  }

  return { rating, content }
}
