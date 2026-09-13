import mongoose from 'mongoose'

const contactMessageSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true, collection: 'contact_messages' },
)

export const ContactMessage = mongoose.model(
  'ContactMessage',
  contactMessageSchema,
)
