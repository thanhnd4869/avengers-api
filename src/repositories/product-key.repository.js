import mongoose from 'mongoose'
import { KEY_STATUS } from '#constants/order.js'
import { ProductKey } from '#models/product-key.model.js'
import { ProductVariant } from '#models/product-variant.model.js'

/**
 * Stocks keys for one variant: `keys` are `{ codeEncrypted, codeHash }`. The
 * keys and the variant's `availableKeys` counter change in one transaction,
 * so the counter never claims a key that is not there. A code already in
 * stock (same fingerprint) fails the whole batch.
 */
export function addProductKeys(variantId, keys) {
  return mongoose.connection.transaction(async (session) => {
    await ProductKey.insertMany(
      keys.map((key) => ({ ...key, variantId, status: KEY_STATUS.AVAILABLE })),
      { session },
    )
    await ProductVariant.updateOne(
      { _id: variantId },
      { $inc: { availableKeys: keys.length } },
      { session },
    )

    return keys.length
  })
}

export function findVariantsWithKeyCounts() {
  return ProductVariant.find({}, { availableKeys: 1 }).lean()
}
