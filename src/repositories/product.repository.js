import { Product } from '@models/product.model.js'

const LISTING_FIELDS =
  'slug name image priceMin priceMax originalPriceMin currency ratingAverage ratingCount hasVariants inStock platforms'

// `_id` breaks ties so paging stays stable when two products share a sort value.
const SORT_ORDER = {
  '-sales': { sales: -1, _id: 1 },
  '-rating': { ratingAverage: -1, ratingCount: -1, _id: 1 },
}

export async function findPublishedProducts({ page, limit, sort }) {
  const filter = { published: true }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(SORT_ORDER[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .select(LISTING_FIELDS),
    Product.countDocuments(filter),
  ])

  return { products, total }
}

export function countPublishedProductsByPlatform(platformSlug) {
  return Product.countDocuments({
    published: true,
    'platforms.slug': platformSlug,
  })
}
