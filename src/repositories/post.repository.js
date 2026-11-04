import { Post } from '#models/post.model.js'
import { PostCategory } from '#models/post-category.model.js'

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function findPublishedPosts({
  page,
  limit,
  categorySlug,
  search,
}) {
  const filter = { published: true }

  if (categorySlug) {
    const category = await PostCategory.findOne({ slug: categorySlug })
      .select('_id')
      .lean()

    // An unknown category is an empty listing, not every post.
    if (!category) {
      return { posts: [], total: 0 }
    }

    filter.categoryId = category._id
  }

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), 'i')

    filter.$or = [{ title: pattern }, { excerpt: pattern }]
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ publishedAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('slug title excerpt image publishedAt commentCount categoryId')
      .populate({ path: 'categoryId', select: 'name slug' }),
    Post.countDocuments(filter),
  ])

  return { posts, total }
}

export function findPublishedPostBySlug(slug) {
  return Post.findOne({ slug, published: true })
    .select(
      'slug title excerpt content image publishedAt commentCount categoryId',
    )
    .populate({ path: 'categoryId', select: 'name slug' })
}

/** The post's id and comment count, or `null` when it is not published. */
export function findPublishedPostRefBySlug(slug) {
  return Post.findOne({ slug, published: true })
    .select('_id commentCount')
    .lean()
}

/**
 * Other published posts, those in the same category first, newest first
 * within each group.
 */
export async function findRelatedPosts({ postId, categoryId, limit }) {
  const select = 'slug title excerpt image publishedAt commentCount categoryId'
  const populate = { path: 'categoryId', select: 'name slug' }
  const sameCategory = await Post.find({
    published: true,
    _id: { $ne: postId },
    categoryId,
  })
    .sort({ publishedAt: -1, _id: 1 })
    .limit(limit)
    .select(select)
    .populate(populate)

  if (sameCategory.length >= limit) return sameCategory

  const others = await Post.find({
    published: true,
    _id: { $nin: [postId, ...sameCategory.map((post) => post._id)] },
  })
    .sort({ publishedAt: -1, _id: 1 })
    .limit(limit - sameCategory.length)
    .select(select)
    .populate(populate)

  return [...sameCategory, ...others]
}
