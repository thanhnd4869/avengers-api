import mongoose from 'mongoose'
import { Cart } from '#models/cart.model.js'
import { Platform } from '#models/platform.model.js'
import { Product } from '#models/product.model.js'
import { ProductVariant } from '#models/product-variant.model.js'

export async function findCart(userId) {
  const cart = await Cart.findOne({ userId }).select('items revision').lean()

  return { items: cart?.items ?? [], revision: cart?.revision ?? 0 }
}

/**
 * Writes the cart only if nobody else has since `revision`. Answers `false`
 * when another write got there first, so the caller can read and try again.
 * A first write creates the cart; a racing first write then fails on the
 * unique `userId` index, which counts as a conflict too.
 */
export async function saveCart(userId, items, revision) {
  try {
    const result = await Cart.updateOne(
      { userId, revision },
      { $set: { items }, $inc: { revision: 1 } },
      { upsert: true },
    )

    return result.matchedCount === 1 || result.upsertedCount === 1
  } catch (error) {
    if (error.code === 11000) return false
    throw error
  }
}

export function deleteCart(userId) {
  return Cart.deleteOne({ userId })
}

/**
 * The given variants that can still be bought: their product and platform are
 * both published. Anything else is missing from the result.
 */
export function findPurchasableVariants(variantIds) {
  return ProductVariant.aggregate([
    {
      $match: {
        _id: { $in: variantIds.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    {
      $lookup: {
        from: Product.collection.name,
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
        pipeline: [
          { $match: { published: true } },
          { $project: { slug: 1, name: 1, image: 1 } },
        ],
      },
    },
    { $unwind: '$product' },
    {
      $lookup: {
        from: Platform.collection.name,
        localField: 'platformId',
        foreignField: '_id',
        as: 'platform',
        pipeline: [
          { $match: { published: true } },
          { $project: { _id: 0, name: 1, slug: 1 } },
        ],
      },
    },
    { $unwind: '$platform' },
    {
      $project: {
        edition: 1,
        price: 1,
        originalPrice: 1,
        currency: 1,
        availableKeys: 1,
        product: 1,
        platform: 1,
      },
    },
  ])
}
