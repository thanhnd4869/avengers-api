import { HTTP_STATUS } from '#constants/http-status.js'
import { clientIp } from '#utils/client-ip.js'

export function createAdminController({ adminService }) {
  return {
    async getOverview(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminService.getOverview(request.query))
    },

    async listOrders(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminService.listOrders(request.query))
    },

    async getOrder(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminService.getOrder(request.params.number))
    },

    async listPayments(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminService.listPayments(request.query))
    },

    async listUsers(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminService.listUsers(request.query))
    },

    async getUser(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await adminService.getUser(request.params.id))
    },

    async markPaymentRefunded(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await adminService.markPaymentRefunded(
            request.params.id,
            request.body,
            { adminId: request.auth.userId },
          ),
        )
    },

    async refundPaymentViaVnpay(request, response) {
      response.status(HTTP_STATUS.OK).json(
        await adminService.refundPaymentViaVnpay(
          request.params.id,
          request.body,
          {
            adminId: request.auth.userId,
            ipAddr: clientIp(request),
          },
        ),
      )
    },
  }
}
