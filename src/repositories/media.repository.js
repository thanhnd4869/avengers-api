import { Media } from '@models/media.model.js'

export function findPublishedMedia({ type, limit }) {
  return Media.find({ published: true, ...(type ? { type } : {}) })
    .sort({ sortOrder: 1, _id: 1 })
    .limit(limit)
    .select('type image url')
}
