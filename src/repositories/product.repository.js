import { Platform } from '@models/platform.model.js'
import { Product } from '@models/product.model.js'
import { ProductVariant } from '@models/product-variant.model.js'

// `_id` breaks ties so paging stays stable when two products share a sort value.
const SORT_ORDER = {
  '-sales': { salesCount: -1, _id: 1 },
  '-rating': { ratingAverage: -1, ratingCount: -1, _id: 1 },
  '-releaseDate': { releaseDate: -1, _id: 1 },
  releaseDate: { releaseDate: 1, _id: 1 },
  '-discount': { discountRate: -1, salesCount: -1, _id: 1 },
}

/**
 * Filters that only need the product document, applied before the variants
 * are joined so the join runs on as few products as possible.
 */
function productFilter({ collection, now }) {
  const filter = { published: true }

  if (collection === 'new-releases') {
    filter.isPreorder = false
    filter.releaseDate = { $lte: now }
  }

  if (collection === 'pre-orders') {
    filter.$or = [{ isPreorder: true }, { releaseDate: { $gt: now } }]
  }

  return filter
}

// Joins each product's variants together with the platform they are sold on.
// Variants on an unpublished platform are dropped, so they neither appear as a
// badge nor count towards the price range.
const JOIN_VARIANTS = {
  $lookup: {
    from: ProductVariant.collection.name,
    localField: '_id',
    foreignField: 'productId',
    as: 'variants',
    pipeline: [
      {
        $lookup: {
          from: Platform.collection.name,
          localField: 'platformId',
          foreignField: '_id',
          as: 'platform',
        },
      },
      { $unwind: '$platform' },
      { $match: { 'platform.published': true } },
    ],
  },
}

// Everything a product card shows about price, stock and platforms is derived
// from the variants here, so it can never drift out of sync with them.
const DERIVE_LISTING_FIELDS = [
  {
    $addFields: {
      cheapest: {
        $first: { $sortArray: { input: '$variants', sortBy: { price: 1 } } },
      },
    },
  },
  {
    $addFields: {
      priceMin: '$cheapest.price',
      priceMax: { $max: '$variants.price' },
      currency: '$cheapest.currency',
      // The struck-through price belongs to the variant whose price is shown,
      // otherwise the card would compare two unrelated editions.
      originalPriceMin: {
        $cond: [
          { $gt: ['$cheapest.originalPrice', '$cheapest.price'] },
          '$cheapest.originalPrice',
          null,
        ],
      },
      hasVariants: { $gt: [{ $size: '$variants' }, 1] },
      inStock: {
        $anyElementTrue: {
          $map: { input: '$variants', in: { $gt: ['$$this.stock', 0] } },
        },
      },
      isDeal: {
        $anyElementTrue: {
          $map: {
            input: '$variants',
            in: { $gt: ['$$this.originalPrice', '$$this.price'] },
          },
        },
      },
      platforms: {
        $map: {
          input: {
            $sortArray: {
              input: {
                $setUnion: [
                  {
                    $map: {
                      input: '$variants',
                      in: {
                        sortOrder: '$$this.platform.sortOrder',
                        name: '$$this.platform.name',
                        slug: '$$this.platform.slug',
                      },
                    },
                  },
                ],
              },
              sortBy: { sortOrder: 1, slug: 1 },
            },
          },
          in: { name: '$$this.name', slug: '$$this.slug' },
        },
      },
    },
  },
  {
    $addFields: {
      discountRate: {
        $cond: [
          { $gt: ['$originalPriceMin', null] },
          {
            $divide: [
              { $subtract: ['$originalPriceMin', '$priceMin'] },
              '$originalPriceMin',
            ],
          },
          0,
        ],
      },
    },
  },
]

const LISTING_PROJECTION = {
  $project: {
    _id: 0,
    id: { $toString: '$_id' },
    slug: 1,
    name: 1,
    image: 1,
    releaseDate: 1,
    isPreorder: 1,
    priceMin: 1,
    priceMax: 1,
    originalPriceMin: 1,
    currency: 1,
    ratingAverage: 1,
    ratingCount: 1,
    hasVariants: 1,
    inStock: 1,
    platforms: 1,
  },
}

export async function findPublishedProducts({
  page,
  limit,
  sort,
  collection,
  platformSlug,
  now = new Date(),
}) {
  // A product with no sellable variant has no price to show, so it is left
  // out of every listing.
  const variantFilter = { 'variants.0': { $exists: true } }

  if (collection === 'deals') {
    variantFilter.isDeal = true
  }

  if (platformSlug) {
    variantFilter['platforms.slug'] = platformSlug
  }

  const [result] = await Product.aggregate([
    { $match: productFilter({ collection, now }) },
    JOIN_VARIANTS,
    ...DERIVE_LISTING_FIELDS,
    { $match: variantFilter },
    {
      $facet: {
        data: [
          { $sort: SORT_ORDER[sort] },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          LISTING_PROJECTION,
        ],
        total: [{ $count: 'value' }],
      },
    },
  ])

  return { products: result.data, total: result.total[0]?.value ?? 0 }
}
