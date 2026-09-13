import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'
import { imageSchema } from './schemas/image.schema.js'

// Denormalised so a product listing can render platform badges without a join.
const productPlatformSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
  },
  { _id: false },
)

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    image: { type: imageSchema, required: true },
    priceMin: { type: Number, required: true, min: 0 },
    priceMax: { type: Number, required: true, min: 0 },
    originalPriceMin: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'USD' },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    sales: { type: Number, default: 0, min: 0 },
    hasVariants: { type: Boolean, default: false },
    inStock: { type: Boolean, default: true },
    platforms: { type: [productPlatformSchema], default: [] },
    published: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'products' },
)

productSchema.index({ published: 1, sales: -1 })
productSchema.index({ published: 1, ratingAverage: -1, ratingCount: -1 })
productSchema.index({ published: 1, 'platforms.slug': 1 })
productSchema.plugin(publicJsonPlugin)

export const Product = mongoose.model('Product', productSchema)
