import { Platform } from '@models/platform.model.js'
import { Product } from '@models/product.model.js'
import { ProductVariant } from '@models/product-variant.model.js'

/**
 * Published platforms with the number of published products sold on each,
 * counted in one query rather than one per platform.
 */
export function findPublishedPlatformsWithProductCount() {
  return Platform.aggregate([
    { $match: { published: true } },
    { $sort: { sortOrder: 1, _id: 1 } },
    {
      $lookup: {
        from: ProductVariant.collection.name,
        localField: '_id',
        foreignField: 'platformId',
        as: 'products',
        pipeline: [
          { $group: { _id: '$productId' } },
          {
            $lookup: {
              from: Product.collection.name,
              localField: '_id',
              foreignField: '_id',
              as: 'product',
              pipeline: [
                { $match: { published: true } },
                { $project: { _id: 1 } },
              ],
            },
          },
          { $match: { 'product.0': { $exists: true } } },
        ],
      },
    },
    {
      $project: {
        _id: 0,
        id: { $toString: '$_id' },
        name: 1,
        slug: 1,
        image: 1,
        productCount: { $size: '$products' },
      },
    },
  ])
}
