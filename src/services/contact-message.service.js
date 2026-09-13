import { validateContactMessageBody } from '@validations/contact-message.validation.js'

export function createContactMessageService({ contactMessageRepository }) {
  return {
    async submitContactMessage(body) {
      await contactMessageRepository.createContactMessage(
        validateContactMessageBody(body),
      )

      return {
        data: { success: true, message: 'Thank you, we will reply shortly.' },
      }
    },
  }
}
