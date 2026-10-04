import { HTTP_STATUS } from '@constants/http-status.js'

export function createAdminContactMessageController({
  adminContactMessageService,
}) {
  return {
    async listContactMessages(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminContactMessageService.listContactMessages(request.query),
        )
    },

    async updateContactMessageStatus(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminContactMessageService.updateContactMessageStatus(
            request.params.id,
            request.body,
          ),
        )
    },
  }
}
