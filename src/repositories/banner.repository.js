import { Banner } from '@models/banner.model.js'

export function findPublishedBanners({ limit }) {
  return Banner.find({ published: true })
    .sort({ sortOrder: 1, _id: 1 })
    .limit(limit)
    .select('title excerpt image linkUrl linkLabel')
}
