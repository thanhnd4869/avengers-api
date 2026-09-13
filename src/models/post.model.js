import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'
import { imageSchema } from './schemas/image.schema.js'

// Denormalised so a post listing can render its category without a join.
const postCategoryReferenceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
  },
  { _id: false },
)

const postSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    image: { type: imageSchema, required: true },
    publishedAt: { type: Date, required: true },
    commentCount: { type: Number, default: 0, min: 0 },
    category: { type: postCategoryReferenceSchema, required: true },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
)

postSchema.index({ published: 1, publishedAt: -1 })
postSchema.index({ published: 1, 'category.slug': 1, publishedAt: -1 })
postSchema.plugin(publicJsonPlugin)

export const Post = mongoose.model('Post', postSchema)
