import {
  Banner,
  ContactMessage,
  Platform,
  Post,
  PostCategory,
  Product,
} from '@models/home-content.model.js'

const publicOptions = { _id: 0, id: { $toString: '$_id' } }

function withId(document) {
  return { id: document._id.toString(), ...document, _id: undefined }
}

export async function findBanners(limit) {
  return Banner.aggregate([
    { $match: { published: true } },
    { $sort: { sortOrder: 1, _id: 1 } },
    { $limit: limit },
    {
      $project: {
        ...publicOptions,
        title: 1,
        excerpt: 1,
        image: 1,
        linkUrl: 1,
        linkLabel: 1,
      },
    },
  ])
}

export async function findPlatforms() {
  const platforms = await Platform.aggregate([
    { $match: { published: true } },
    { $sort: { sortOrder: 1, _id: 1 } },
    { $project: { ...publicOptions, name: 1, slug: 1, image: 1 } },
  ])

  return Promise.all(
    platforms.map(async (platform) => ({
      ...platform,
      productCount: await Product.countDocuments({
        published: true,
        'platforms.slug': platform.slug,
      }),
    })),
  )
}

export async function findProducts({ page, limit, sort }) {
  const filter = { published: true }
  const sortBy =
    sort === '-rating'
      ? { ratingAverage: -1, ratingCount: -1, _id: 1 }
      : { sales: -1, _id: 1 }
  const [data, total] = await Promise.all([
    Product.find(filter)
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        'slug name image priceMin priceMax originalPriceMin currency ratingAverage ratingCount hasVariants inStock platforms',
      )
      .lean(),
    Product.countDocuments(filter),
  ])

  return { data: data.map(withId), total }
}

export async function findPosts({ page, limit, category }) {
  const filter = {
    published: true,
    ...(category ? { 'category.slug': category } : {}),
  }
  const [data, total] = await Promise.all([
    Post.find(filter)
      .sort({ publishedAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('slug title excerpt image publishedAt commentCount category.name')
      .lean(),
    Post.countDocuments(filter),
  ])

  return { data: data.map(withId), total }
}

export function findPostCategories() {
  return PostCategory.find({ slug: { $ne: 'all' } })
    .sort({ sortOrder: 1, _id: 1 })
    .select('-_id name slug')
    .lean()
}

export function createContactMessage(contact) {
  return ContactMessage.create(contact)
}
