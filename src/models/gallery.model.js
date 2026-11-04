import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'
import { imageSchema } from './schemas/image.schema.js'

/**
 * A named album of pictures, shown as a cover on the gallery page; opening it
 * steps through its images. Each image URL is the full-size picture.
 */
const gallerySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    cover: { type: imageSchema, required: true },
    images: { type: [imageSchema], default: [] },
    sortOrder: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'galleries' },
)

gallerySchema.index({ published: 1, sortOrder: 1 })
gallerySchema.plugin(publicJsonPlugin)

export const Gallery = mongoose.model('Gallery', gallerySchema)
