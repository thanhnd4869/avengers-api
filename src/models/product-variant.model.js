import mongoose from 'mongoose'

/**
 * One purchasable key: a product on a given platform in a given edition.
 *
 * Price and stock live here rather than on the product because they differ
 * per platform and edition. Product listings derive their price range, stock
 * and platform badges from these rows when they are read.
 */
const productVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    platformId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Platform',
      required: true,
    },
    edition: { type: String, default: 'Standard', trim: true },
    // Whole dong: VND has no minor unit.
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'VND', uppercase: true },
    // How many of this variant's keys are for sale. Kept in step with
    // `product_keys` inside every transaction that changes a key's status;
    // reserving a key decrements it only while it is high enough, which is
    // what stops two checkouts from selling the same last key.
    availableKeys: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'product_variants' },
)

productVariantSchema.index(
  { productId: 1, platformId: 1, edition: 1 },
  { unique: true },
)
productVariantSchema.index({ platformId: 1 })

export const ProductVariant = mongoose.model(
  'ProductVariant',
  productVariantSchema,
)
