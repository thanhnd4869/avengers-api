import mongoose from 'mongoose'
import { CONTACT_MESSAGE_STATUSES } from '#constants/contact-message.js'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

const contactMessageSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: CONTACT_MESSAGE_STATUSES, default: 'new' },
  },
  { timestamps: true, collection: 'contact_messages' },
)

contactMessageSchema.index({ status: 1, createdAt: -1 })
contactMessageSchema.plugin(publicJsonPlugin)

export const ContactMessage = mongoose.model(
  'ContactMessage',
  contactMessageSchema,
)
