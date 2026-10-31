import { HTTP_STATUS } from '#constants/http-status.js'

export function createOrderController({ orderService }) {
  return {
    async createOrder(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(await orderService.createOrder(request.auth.userId, request.body))
    },

    async listOrders(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await orderService.listOrders(request.auth.userId, request.query))
    },

    async getPendingOrder(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await orderService.getPendingOrder(request.auth.userId))
    },

    async getOrder(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await orderService.getOrder(
            request.auth.userId,
            request.params.number,
          ),
        )
    },

    async cancelOrder(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await orderService.cancelOrder(
            request.auth.userId,
            request.params.number,
          ),
        )
    },
  }
}
