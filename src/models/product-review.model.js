import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

/**
 * A customer's rating and comment on a product. The product keeps its own
 * `ratingAverage` and `ratingCount`, so listings never have to aggregate these.
 */
const productReviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    authorName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, required: true },
  },
  { timestamps: true, collection: 'product_reviews' },
)

productReviewSchema.index({ productId: 1, createdAt: -1 })
productReviewSchema.plugin(publicJsonPlugin)

export const ProductReview = mongoose.model(
  'ProductReview',
  productReviewSchema,
)
