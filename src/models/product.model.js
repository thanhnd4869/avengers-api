import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'
import { imageSchema } from './schemas/image.schema.js'

/**
 * The game itself. Price, stock and platforms belong to its variants
 * (`product_variants`), so they are not stored here.
 *
 * `releaseDate` drives the New Releases and Coming Soon rows; `isPreorder`
 * marks a title the shop already takes orders for before that date.
 *
 * `image` is the cover used by cards and as the first gallery slide;
 * `gallery` holds the extra screenshots shown only on the product page.
 */
const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    shortDescription: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: imageSchema, required: true },
    gallery: { type: [imageSchema], default: [] },
    categoryIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory' }],
      default: [],
    },
    tags: { type: [String], default: [] },
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
productSchema.index({ published: 1, categoryIds: 1 })
productSchema.plugin(publicJsonPlugin)

export const Product = mongoose.model('Product', productSchema)
