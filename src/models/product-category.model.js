import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

/**
 * Genre a game is filed under, such as Action or MMO. Platforms are a separate
 * dimension (`platforms`), so a category never names one.
 */
const productCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'product_categories' },
)

productCategorySchema.index({ sortOrder: 1 })
productCategorySchema.plugin(publicJsonPlugin)

export const ProductCategory = mongoose.model(
  'ProductCategory',
  productCategorySchema,
)
