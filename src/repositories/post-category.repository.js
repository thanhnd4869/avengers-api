import { PostCategory } from '@models/post-category.model.js'

export function findPostCategories({ excludedSlugs = [] } = {}) {
  return PostCategory.find({ slug: { $nin: excludedSlugs } })
    .sort({ sortOrder: 1, _id: 1 })
    .select('-_id name slug')
    .lean()
}
