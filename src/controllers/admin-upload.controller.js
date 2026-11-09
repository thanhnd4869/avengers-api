import { HTTP_STATUS } from '#constants/http-status.js'

export function createAdminUploadController({ adminUploadService }) {
  return {
    async getUploadConfig(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json({ data: { enabled: adminUploadService.isEnabled() } })
    },

    async createUploadSignature(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(adminUploadService.createUploadSignature(request.body))
    },
  }
}
