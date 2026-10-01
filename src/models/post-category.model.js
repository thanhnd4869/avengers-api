import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

const postCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'post_categories' },
)

postCategorySchema.index({ sortOrder: 1 })
postCategorySchema.plugin(publicJsonPlugin)

export const PostCategory = mongoose.model('PostCategory', postCategorySchema)
