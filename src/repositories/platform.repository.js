import { Platform } from '@models/platform.model.js'

export function findPublishedPlatforms() {
  return Platform.find({ published: true })
    .sort({ sortOrder: 1, _id: 1 })
    .select('name slug image')
}
