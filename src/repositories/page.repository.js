import { Page } from '#models/page.model.js'

export function findPublishedPageBySlug(slug) {
  return Page.findOne({ slug, published: true }).select(
    'slug title summary sections updatedAt',
  )
}
