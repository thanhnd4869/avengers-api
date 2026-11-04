import { Gallery } from '#models/gallery.model.js'

export function findPublishedGalleries({ limit }) {
  return Gallery.find({ published: true })
    .sort({ sortOrder: 1, _id: 1 })
    .limit(limit)
    .select('slug title cover images')
}
