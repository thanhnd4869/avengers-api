import { ContactMessage } from '#models/contact-message.model.js'

export function createContactMessage({ email, message }) {
  return ContactMessage.create({ email, message })
}

export async function findContactMessages({ page, limit, status }) {
  const filter = status ? { status } : {}

  const [messages, total] = await Promise.all([
    ContactMessage.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ContactMessage.countDocuments(filter),
  ])

  return { messages, total }
}

export function updateContactMessageStatus(id, status) {
  return ContactMessage.findByIdAndUpdate(
    id,
    { $set: { status } },
    { returnDocument: 'after', runValidators: true },
  )
}
