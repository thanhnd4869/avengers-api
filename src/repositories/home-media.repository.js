import { HomeMedia } from '@models/home-media.model.js'

export function findHomeMedia() {
  return HomeMedia.findOne()
    .sort({ _id: -1 })
    .select('-_id socialLinks latestVideo screenshots')
    .lean()
}
