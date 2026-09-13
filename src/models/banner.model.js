import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'
import { imageSchema } from './schemas/image.schema.js'

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    image: { type: imageSchema, required: true },
    linkUrl: { type: String, default: null },
    linkLabel: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'banners' },
)

bannerSchema.index({ published: 1, sortOrder: 1 })
bannerSchema.plugin(publicJsonPlugin)

export const Banner = mongoose.model('Banner', bannerSchema)
