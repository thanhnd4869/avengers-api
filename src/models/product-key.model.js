import mongoose from 'mongoose'
import { KEY_STATUS } from '#constants/order.js'

/**
 * One activation key for one variant. The code is stored encrypted (see
 * utils/key-cipher.js) and never selected unless a query asks for it; its
 * fingerprint stops the same key from being stocked twice.
 *
 * `available` keys are for sale, `reserved` ones are held by `orderId` while
 * its shopper pays, and `sold` ones belong to that order for good. The
 * variant's `availableKeys` counter is changed in the same transaction as
 * these statuses, so the two always agree.
 */
const productKeySchema = new mongoose.Schema(
  {
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: true,
    },
    codeEncrypted: { type: String, required: true, select: false },
    codeHash: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(KEY_STATUS),
      default: KEY_STATUS.AVAILABLE,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    reservedAt: { type: Date, default: null },
    soldAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'product_keys' },
)

productKeySchema.index({ codeHash: 1 }, { unique: true })
// Picking keys to reserve: the oldest available keys of a variant first.
productKeySchema.index({ variantId: 1, status: 1, _id: 1 })
productKeySchema.index({ orderId: 1 })

export const ProductKey = mongoose.model('ProductKey', productKeySchema)
