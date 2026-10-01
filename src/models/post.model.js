import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'
import { imageSchema } from './schemas/image.schema.js'

const postSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    content: { type: String, default: '' },
    image: { type: imageSchema, required: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PostCategory',
      required: true,
    },
    publishedAt: { type: Date, required: true },
    commentCount: { type: Number, default: 0, min: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'posts' },
)

postSchema.index({ published: 1, publishedAt: -1 })
postSchema.index({ published: 1, categoryId: 1, publishedAt: -1 })
postSchema.plugin(publicJsonPlugin)

export const Post = mongoose.model('Post', postSchema)
