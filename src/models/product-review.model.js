import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

/**
 * A customer's rating and comment on a product. The product keeps its own
 * `ratingAverage` and `ratingCount`, recomputed from these in the same
 * transaction as every write, so listings never have to aggregate them.
 *
 * `userId` is set for reviews written on the site, only by shoppers who paid
 * for the game; the seeded sample reviews have none. `authorName` is the
 * display name at the time of writing.
 */
const productReviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    authorName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, required: true },
  },
  { timestamps: true, collection: 'product_reviews' },
)

productReviewSchema.index({ productId: 1, createdAt: -1 })
// One review per shopper per game, enforced by the database so two
// submissions racing each other cannot both land.
productReviewSchema.index(
  { productId: 1, userId: 1 },
  {
    name: 'one_review_per_user',
    unique: true,
    partialFilterExpression: { userId: { $type: 'objectId' } },
  },
)
productReviewSchema.index({ userId: 1 })
productReviewSchema.plugin(publicJsonPlugin)

export const ProductReview = mongoose.model(
  'ProductReview',
  productReviewSchema,
)
