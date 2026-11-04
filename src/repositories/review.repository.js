import mongoose from 'mongoose'
import { ORDER_STATUS } from '#constants/order.js'
import { Order } from '#models/order.model.js'
import { Product } from '#models/product.model.js'
import { ProductReview } from '#models/product-review.model.js'

const DUPLICATE_KEY = 11000

export function isDuplicateReviewError(error) {
  return (
    error?.code === DUPLICATE_KEY &&
    String(error.message).includes('one_review_per_user')
  )
}

function inTransaction(work) {
  return mongoose.connection.transaction((session) => work(session), {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  })
}

/**
 * Sets the product's `ratingAverage` and `ratingCount` from its reviews as
 * they stand inside the transaction. Every review write ends with this and
 * also writes the product, so two transactions changing reviews of the same
 * product conflict, and MongoDB makes one retry with the other's review
 * included: the figures always match the reviews.
 */
async function recomputeRating(productId, session) {
  const [stats] = await ProductReview.aggregate(
    [
      { $match: { productId } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          average: { $avg: '$rating' },
        },
      },
    ],
    { session },
  )

  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        ratingCount: stats?.count ?? 0,
        // One decimal, as the stars show it.
        ratingAverage: stats ? Math.round(stats.average * 10) / 10 : 0,
      },
    },
    { session },
  )
}

/** Whether the shopper has a paid order containing any variant of the game. */
export async function hasPurchasedProduct(userId, productId) {
  const order = await Order.exists({
    userId,
    status: ORDER_STATUS.PAID,
    'items.productId': productId,
  })

  return Boolean(order)
}

export function findUserReview(userId, productId) {
  return ProductReview.findOne({ userId, productId })
}

export function createReview(review) {
  return inTransaction(async (session) => {
    const [created] = await ProductReview.create([review], { session })

    await recomputeRating(review.productId, session)

    return created
  })
}

/** Answers the updated review, or `null` if it is gone. */
export function updateUserReview({ userId, productId, rating, content }) {
  return inTransaction(async (session) => {
    const updated = await ProductReview.findOneAndUpdate(
      { userId, productId },
      { $set: { rating, content } },
      { session, returnDocument: 'after' },
    )

    if (updated) await recomputeRating(productId, session)

    return updated
  })
}

/** Answers whether a review was deleted. */
export function deleteUserReview({ userId, productId }) {
  return inTransaction(async (session) => {
    const { deletedCount } = await ProductReview.deleteOne(
      { userId, productId },
      { session },
    )

    if (deletedCount) await recomputeRating(productId, session)

    return deletedCount === 1
  })
}

/**
 * Removes every review a shopper wrote, when they delete their account, and
 * brings each reviewed product's rating back in line.
 */
export function deleteAllUserReviews(userId) {
  return inTransaction(async (session) => {
    const reviews = await ProductReview.find(
      { userId },
      { productId: 1 },
      { session },
    ).lean()

    if (!reviews.length) return 0

    await ProductReview.deleteMany({ userId }, { session })

    for (const productId of new Set(reviews.map((r) => String(r.productId)))) {
      await recomputeRating(new mongoose.Types.ObjectId(productId), session)
    }

    return reviews.length
  })
}
