import { HTTP_STATUS } from '#constants/http-status.js'

export function createCartController({ cartService }) {
  const send = (response, body) => response.status(HTTP_STATUS.OK).json(body)

  return {
    async getCart(request, response) {
      send(response, await cartService.getCart(request.auth.userId))
    },

    async addItem(request, response) {
      send(
        response,
        await cartService.addItem(request.auth.userId, request.body),
      )
    },

    async setQuantity(request, response) {
      send(
        response,
        await cartService.setQuantity(
          request.auth.userId,
          request.params.variantId,
          request.body,
        ),
      )
    },

    async removeItem(request, response) {
      send(
        response,
        await cartService.removeItem(
          request.auth.userId,
          request.params.variantId,
        ),
      )
    },

    async clearCart(request, response) {
      send(response, await cartService.clearCart(request.auth.userId))
    },

    async mergeCart(request, response) {
      send(
        response,
        await cartService.mergeCart(request.auth.userId, request.body),
      )
    },

    async previewCart(request, response) {
      send(response, await cartService.previewCart(request.body))
    },
  }
}
