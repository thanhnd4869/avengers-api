import mongoose from 'mongoose'

export const CONTACT_MESSAGE_STATUSES = Object.freeze([
  'new',
  'read',
  'replied',
])

const contactMessageSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: CONTACT_MESSAGE_STATUSES, default: 'new' },
  },
  { timestamps: true, collection: 'contact_messages' },
)

contactMessageSchema.index({ status: 1, createdAt: -1 })

export const ContactMessage = mongoose.model(
  'ContactMessage',
  contactMessageSchema,
)
