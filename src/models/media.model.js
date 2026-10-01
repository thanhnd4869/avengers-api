import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'
import { imageSchema } from './schemas/image.schema.js'

export const MEDIA_TYPES = Object.freeze(['screenshot', 'video'])

// `image` is the thumbnail shown on the page and `url` is where it opens: the
// full-size picture for a screenshot, the player page for a video.
const mediaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: MEDIA_TYPES, required: true },
    image: { type: imageSchema, required: true },
    url: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'media' },
)

mediaSchema.index({ published: 1, type: 1, sortOrder: 1 })
mediaSchema.plugin(publicJsonPlugin)

export const Media = mongoose.model('Media', mediaSchema)
