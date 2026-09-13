import mongoose from 'mongoose'

const { Schema } = mongoose

const imageSchema = new Schema(
  {
    large: String,
    medium: String,
    alt: { type: String, required: true },
  },
  { _id: false },
)

const taxonomyReferenceSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
  },
  { _id: false },
)

const bannerSchema = new Schema(
  {
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    image: { type: imageSchema, required: true },
    linkUrl: { type: String, default: null },
    linkLabel: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
)

const platformSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    image: { type: imageSchema, required: true },
    sortOrder: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
)

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    image: { type: imageSchema, required: true },
    priceMin: { type: Number, required: true, min: 0 },
    priceMax: { type: Number, required: true, min: 0 },
    originalPriceMin: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'USD' },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    sales: { type: Number, default: 0, min: 0 },
    hasVariants: { type: Boolean, default: false },
    inStock: { type: Boolean, default: true },
    platforms: {
      type: [taxonomyReferenceSchema],
      default: [],
    },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
)

const postCategorySchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
)

const postSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    image: { type: imageSchema, required: true },
    publishedAt: { type: Date, required: true },
    commentCount: { type: Number, default: 0, min: 0 },
    category: {
      type: taxonomyReferenceSchema,
      required: true,
    },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
)

const contactMessageSchema = new Schema(
  {
    email: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true },
)

function model(name, schema) {
  return mongoose.models[name] ?? mongoose.model(name, schema)
}

export const Banner = model('Banner', bannerSchema)
export const Platform = model('Platform', platformSchema)
export const Product = model('Product', productSchema)
export const PostCategory = model('PostCategory', postCategorySchema)
export const Post = model('Post', postSchema)
export const ContactMessage = model('ContactMessage', contactMessageSchema)
