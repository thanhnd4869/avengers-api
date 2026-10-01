import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'
import { imageSchema } from './schemas/image.schema.js'

/**
 * The game itself. Price, stock and platforms belong to its variants
 * (`product_variants`), so they are not stored here.
 *
 * `releaseDate` drives the New Releases and Coming Soon rows; `isPreorder`
 * marks a title the shop already takes orders for before that date.
 */
const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    image: { type: imageSchema, required: true },
    releaseDate: { type: Date, required: true },
    isPreorder: { type: Boolean, default: false },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    salesCount: { type: Number, default: 0, min: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'products' },
)

productSchema.index({ published: 1, salesCount: -1 })
productSchema.index({ published: 1, ratingAverage: -1, ratingCount: -1 })
productSchema.index({ published: 1, releaseDate: -1 })
productSchema.plugin(publicJsonPlugin)

export const Product = mongoose.model('Product', productSchema)
