import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

/**
 * A titled block of text such as an FAQ entry or a paragraph of a policy.
 * Sections are plain text; the client renders paragraphs from blank lines.
 */
const pageSectionSchema = new mongoose.Schema(
  {
    heading: { type: String, required: true, trim: true },
    body: { type: String, required: true },
  },
  { _id: false },
)

/**
 * Site pages whose content changes without a release: the FAQ and the
 * refund, terms and privacy policies. Kept in the database so a future admin
 * can edit them; `updatedAt` is shown as the policy's "last updated" date.
 */
const pageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    sections: { type: [pageSectionSchema], default: [] },
    published: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'pages' },
)

pageSchema.plugin(publicJsonPlugin)

export const Page = mongoose.model('Page', pageSchema)
