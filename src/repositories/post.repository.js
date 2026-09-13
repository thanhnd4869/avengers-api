import { Post } from '@models/post.model.js'

const LISTING_FIELDS =
  'slug title excerpt image publishedAt commentCount category.name'

export async function findPublishedPosts({ page, limit, categorySlug }) {
  const filter = {
    published: true,
    ...(categorySlug ? { 'category.slug': categorySlug } : {}),
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ publishedAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(LISTING_FIELDS),
    Post.countDocuments(filter),
  ])

  return { posts, total }
}
