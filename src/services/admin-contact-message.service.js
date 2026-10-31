import { NotFoundError } from '#errors/app-error.js'
import {
  validateContactMessageId,
  validateContactMessageListQuery,
  validateContactMessageStatusBody,
} from '#validations/admin-contact-message.validation.js'
import { toPaginatedResponse } from './pagination.js'

export function createAdminContactMessageService({ contactMessageRepository }) {
  return {
    async listContactMessages(query) {
      const { page, limit, status } = validateContactMessageListQuery(query)
      const { messages, total } =
        await contactMessageRepository.findContactMessages({
          page,
          limit,
          status,
        })

      return toPaginatedResponse(messages, { page, limit, total })
    },

    async updateContactMessageStatus(id, body) {
      const messageId = validateContactMessageId(id)
      const { status } = validateContactMessageStatusBody(body)
      const message = await contactMessageRepository.updateContactMessageStatus(
        messageId,
        status,
      )

      if (!message) {
        throw new NotFoundError('Contact message not found.')
      }

      return { data: message }
    },
  }
}
