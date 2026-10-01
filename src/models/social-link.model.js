import mongoose from 'mongoose'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

// `network` names the icon the client draws, so it stays a short lowercase key
// such as `twitch` or `google-plus`.
const socialLinkSchema = new mongoose.Schema(
  {
    network: { type: String, required: true, unique: true, lowercase: true },
    label: { type: String, required: true },
    url: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'social_links' },
)

socialLinkSchema.index({ sortOrder: 1 })
socialLinkSchema.plugin(publicJsonPlugin)

export const SocialLink = mongoose.model('SocialLink', socialLinkSchema)
