import mongoose from 'mongoose'
import { KEY_STATUS } from '#constants/order.js'
import { Platform } from '#models/platform.model.js'
import { Product } from '#models/product.model.js'
import { ProductCategory } from '#models/product-category.model.js'
import { ProductKey } from '#models/product-key.model.js'
import { ProductVariant } from '#models/product-variant.model.js'

// Stocking shares the transaction that keeps `availableKeys` in step.
export { addProductKeys } from './product-key.repository.js'

const DUPLICATE_KEY = 11000

export function isDuplicateKeyError(error) {
  return error?.code === DUPLICATE_KEY
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function findProducts({ page, limit, search, published }) {
  const filter = {}

  if (search) filter.name = new RegExp(escapeRegExp(search), 'i')
  if (published !== undefined) filter.published = published

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ])

  return { products, total }
}

export function findProductById(productId) {
  return Product.findById(productId).lean()
}

export async function createProduct(product) {
  const created = await Product.create(product)

  return created.toObject()
}

export function updateProduct(productId, changes) {
  return Product.findByIdAndUpdate(
    productId,
    { $set: changes },
    { returnDocument: 'after', runValidators: true, lean: true },
  )
}

/** Every variant of the given products, with the platform it is sold on. */
export function findVariantsForProducts(productIds) {
  return ProductVariant.aggregate([
    { $match: { productId: { $in: productIds } } },
    {
      $lookup: {
        from: Platform.collection.name,
        localField: 'platformId',
        foreignField: '_id',
        as: 'platform',
      },
    },
    { $unwind: { path: '$platform', preserveNullAndEmptyArrays: true } },
    { $sort: { 'platform.sortOrder': 1, price: 1, edition: 1 } },
  ])
}

/** Keys per variant and status, for the given variants. */
export async function countKeysByStatus(variantIds) {
  const rows = await ProductKey.aggregate([
    { $match: { variantId: { $in: variantIds } } },
    {
      $group: {
        _id: { variantId: '$variantId', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ])
  const counts = new Map()

  for (const row of rows) {
    const id = String(row._id.variantId)
    const entry = counts.get(id) ?? {
      [KEY_STATUS.AVAILABLE]: 0,
      [KEY_STATUS.RESERVED]: 0,
      [KEY_STATUS.SOLD]: 0,
    }

    entry[row._id.status] = row.count
    counts.set(id, entry)
  }

  return counts
}

export function findVariantById(variantId) {
  return ProductVariant.findById(variantId).lean()
}

export async function createVariant(variant) {
  const created = await ProductVariant.create(variant)

  return created.toObject()
}

export function updateVariant(variantId, changes) {
  return ProductVariant.findByIdAndUpdate(
    variantId,
    { $set: changes },
    { returnDocument: 'after', runValidators: true, lean: true },
  )
}

/**
 * Deletes a variant that never had a key. Checked and deleted in one
 * transaction, so a key stocked in between cannot be orphaned. Answers
 * `deleted`, `has_keys` or `not_found`.
 */
export function deleteVariantWithoutKeys(variantId) {
  return mongoose.connection.transaction(async (session) => {
    const keys = await ProductKey.countDocuments({ variantId }, { session })

    if (keys > 0) return 'has_keys'

    const result = await ProductVariant.deleteOne(
      { _id: variantId },
      { session },
    )

    return result.deletedCount === 1 ? 'deleted' : 'not_found'
  })
}

/** Which of these fingerprints are already in stock. */
export async function findExistingKeyHashes(hashes) {
  const keys = await ProductKey.find(
    { codeHash: { $in: hashes } },
    { codeHash: 1 },
  ).lean()

  return new Set(keys.map((key) => key.codeHash))
}

export function findPlatforms() {
  return Platform.find().sort({ sortOrder: 1, _id: 1 }).lean()
}

export function findPlatformById(platformId) {
  return Platform.findById(platformId).lean()
}

export function findCategories() {
  return ProductCategory.find().sort({ sortOrder: 1, _id: 1 }).lean()
}

export function countCategories(categoryIds) {
  return ProductCategory.countDocuments({ _id: { $in: categoryIds } })
}
