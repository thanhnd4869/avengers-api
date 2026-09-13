import { HTTP_STATUS } from '@constants/http-status.js'

export function createContactMessageController({ contactMessageService }) {
  return {
    async submitContactMessage(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await contactMessageService.submitContactMessage(request.body))
    },
  }
}
