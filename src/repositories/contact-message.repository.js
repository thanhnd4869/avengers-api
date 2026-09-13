import { ContactMessage } from '@models/contact-message.model.js'

export function createContactMessage({ email, message }) {
  return ContactMessage.create({ email, message })
}
