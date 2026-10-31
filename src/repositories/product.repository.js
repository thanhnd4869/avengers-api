import { Platform } from '#models/platform.model.js'
import { Product } from '#models/product.model.js'
import { ProductCategory } from '#models/product-category.model.js'
import { ProductReview } from '#models/product-review.model.js'
import { ProductVariant } from '#models/product-variant.model.js'

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// `_id` breaks ties so paging stays stable when two products share a sort value.
const SORT_ORDER = {
  '-sales': { salesCount: -1, _id: 1 },
  '-rating': { ratingAverage: -1, ratingCount: -1, _id: 1 },
  '-releaseDate': { releaseDate: -1, _id: 1 },
  releaseDate: { releaseDate: 1, _id: 1 },
  '-discount': { discountRate: -1, salesCount: -1, _id: 1 },
  price: { priceMin: 1, _id: 1 },
  '-price': { priceMax: -1, _id: 1 },
}

/**
 * Filters that only need the product document, applied before the variants
 * are joined so the join runs on as few products as possible.
 */
function productFilter({ collection, categoryId, search, now }) {
  const filter = { published: true }

  if (categoryId) {
    filter.categoryIds = categoryId
  }

  if (search) {
    filter.name = new RegExp(escapeRegExp(search), 'i')
  }

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
          $map: {
            input: '$variants',
            in: { $gt: ['$$this.availableKeys', 0] },
          },
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
    shortDescription: 1,
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
    // A game sold as one variant can go straight into the cart from a card.
    variantId: {
      $cond: [
        { $eq: [{ $size: '$variants' }, 1] },
        { $toString: '$cheapest._id' },
        null,
      ],
    },
    inStock: 1,
    platforms: 1,
  },
}

async function findCategoryId(slug) {
  const category = await ProductCategory.findOne({ slug }).select('_id').lean()

  return category?._id
}

export async function findPublishedProducts({
  page,
  limit,
  sort,
  collection,
  platformSlug,
  categorySlug,
  search,
  minPrice,
  maxPrice,
  now = new Date(),
}) {
  let categoryId

  if (categorySlug) {
    categoryId = await findCategoryId(categorySlug)

    // An unknown category is an empty listing, not every product.
    if (!categoryId) {
      return { products: [], total: 0 }
    }
  }

  // A product with no sellable variant has no price to show, so it is left
  // out of every listing.
  const variantFilter = { 'variants.0': { $exists: true } }

  if (collection === 'deals') {
    variantFilter.isDeal = true
  }

  if (platformSlug) {
    variantFilter['platforms.slug'] = platformSlug
  }

  // A product matches when one of its variants is sold within the range (and
  // on the chosen platform), so a game priced $49 - $69 is found by a $60 -
  // $70 filter.
  const priceFilter = {}

  if (minPrice !== undefined || maxPrice !== undefined) {
    priceFilter.variants = {
      $elemMatch: {
        price: {
          ...(minPrice !== undefined && { $gte: minPrice }),
          ...(maxPrice !== undefined && { $lte: maxPrice }),
        },
        ...(platformSlug && { 'platform.slug': platformSlug }),
      },
    }
  }

  const [result] = await Product.aggregate([
    { $match: productFilter({ collection, categoryId, search, now }) },
    JOIN_VARIANTS,
    ...DERIVE_LISTING_FIELDS,
    { $match: variantFilter },
    {
      $facet: {
        data: [
          { $match: priceFilter },
          { $sort: SORT_ORDER[sort] },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          LISTING_PROJECTION,
        ],
        total: [{ $match: priceFilter }, { $count: 'value' }],
        // Bounds for a price slider. They ignore the price filter itself, so
        // the slider keeps its full range while the visitor narrows it.
        priceRange: [
          {
            $group: {
              _id: null,
              min: { $min: '$priceMin' },
              max: { $max: '$priceMax' },
            },
          },
        ],
      },
    },
  ])

  const [range] = result.priceRange

  return {
    products: result.data,
    total: result.total[0]?.value ?? 0,
    priceRange: range ? { min: range.min, max: range.max } : null,
  }
}

const VARIANT_PROJECTION = {
  $map: {
    input: {
      $sortArray: {
        input: '$variants',
        sortBy: { 'platform.sortOrder': 1, price: 1, edition: 1 },
      },
    },
    in: {
      id: { $toString: '$$this._id' },
      platform: { name: '$$this.platform.name', slug: '$$this.platform.slug' },
      edition: '$$this.edition',
      price: '$$this.price',
      originalPrice: {
        $cond: [
          { $gt: ['$$this.originalPrice', '$$this.price'] },
          '$$this.originalPrice',
          null,
        ],
      },
      currency: '$$this.currency',
      // Shoppers only need to know whether a key can be bought; the exact
      // stock level stays internal.
      inStock: { $gt: ['$$this.availableKeys', 0] },
    },
  },
}

/**
 * One published product with everything its page shows: the listing fields,
 * each purchasable variant, its categories and gallery.
 */
export async function findPublishedProductBySlug(slug) {
  const [product] = await Product.aggregate([
    { $match: { slug, published: true } },
    JOIN_VARIANTS,
    ...DERIVE_LISTING_FIELDS,
    { $match: { 'variants.0': { $exists: true } } },
    {
      $lookup: {
        from: ProductCategory.collection.name,
        localField: 'categoryIds',
        foreignField: '_id',
        as: 'categories',
        pipeline: [
          { $sort: { sortOrder: 1, _id: 1 } },
          { $project: { _id: 0, name: 1, slug: 1 } },
        ],
      },
    },
    {
      $project: {
        ...LISTING_PROJECTION.$project,
        description: 1,
        gallery: 1,
        tags: 1,
        categories: 1,
        variants: VARIANT_PROJECTION,
      },
    },
  ])

  return product ?? null
}

/**
 * Other published products, those sharing the most categories with the given
 * one first and the best sellers among them after that. `null` when the
 * product itself does not exist.
 */
export async function findRelatedProducts({ slug, limit }) {
  const product = await Product.findOne({ slug, published: true })
    .select('_id categoryIds')
    .lean()

  if (!product) {
    return null
  }

  return Product.aggregate([
    { $match: { published: true, _id: { $ne: product._id } } },
    {
      $addFields: {
        sharedCategories: {
          $size: { $setIntersection: ['$categoryIds', product.categoryIds] },
        },
      },
    },
    JOIN_VARIANTS,
    ...DERIVE_LISTING_FIELDS,
    { $match: { 'variants.0': { $exists: true } } },
    { $sort: { sharedCategories: -1, salesCount: -1, _id: 1 } },
    { $limit: limit },
    LISTING_PROJECTION,
  ])
}

export async function findProductIdBySlug(slug) {
  const product = await Product.findOne({ slug, published: true })
    .select('_id')
    .lean()

  return product?._id ?? null
}

export async function findProductReviews({ productId, page, limit }) {
  const filter = { productId }
  const [reviews, total] = await Promise.all([
    ProductReview.find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('authorName rating content createdAt'),
    ProductReview.countDocuments(filter),
  ])

  return { reviews, total }
}

export function findProductCategories() {
  return ProductCategory.find()
    .sort({ sortOrder: 1, _id: 1 })
    .select('name slug')
}
