import mongoose from 'mongoose'

const postCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
)

postCategorySchema.index({ sortOrder: 1 })

export const PostCategory = mongoose.model('PostCategory', postCategorySchema)
