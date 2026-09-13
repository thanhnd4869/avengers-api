import mongoose from 'mongoose'
import { imageSchema } from './schemas/image.schema.js'

const socialLinkSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
)

const latestVideoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    image: { type: imageSchema, required: true },
  },
  { _id: false },
)

const screenshotSchema = new mongoose.Schema(
  {
    linkUrl: { type: String, default: null },
    image: { type: imageSchema, required: true },
  },
  { _id: false },
)

// A singleton document: the sidebar shows one set of widgets at a time.
const homeMediaSchema = new mongoose.Schema(
  {
    socialLinks: { type: [socialLinkSchema], default: [] },
    latestVideo: { type: latestVideoSchema, default: null },
    screenshots: { type: [screenshotSchema], default: [] },
  },
  { timestamps: true },
)

export const HomeMedia = mongoose.model('HomeMedia', homeMediaSchema)
