import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'
import { imageSchema } from './schemas/image.schema.js'

const platformSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    image: { type: imageSchema, required: true },
    sortOrder: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'platforms' },
)

platformSchema.index({ published: 1, sortOrder: 1 })
platformSchema.plugin(publicJsonPlugin)

export const Platform = mongoose.model('Platform', platformSchema)
