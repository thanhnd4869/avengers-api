import { Post } from '#models/post.model.js'
import { Product } from '#models/product.model.js'

/** Slugs and last-change dates of the published games and posts. */
export async function findSitemapEntries() {
  const [products, posts] = await Promise.all([
    Product.find({ published: true }, { slug: 1, updatedAt: 1 })
      .sort({ _id: 1 })
      .lean(),
    Post.find(
      { published: true, publishedAt: { $lte: new Date() } },
      { slug: 1, updatedAt: 1 },
    )
      .sort({ _id: 1 })
      .lean(),
  ])

  return { products, posts }
}
