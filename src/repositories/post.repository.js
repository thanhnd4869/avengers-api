import { Post } from '@models/post.model.js'
import { PostCategory } from '@models/post-category.model.js'

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
