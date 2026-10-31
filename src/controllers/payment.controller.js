import { HTTP_STATUS } from '#constants/http-status.js'

// VNPay wants a plain address; Node reports IPv4 clients as IPv4-mapped IPv6.
function clientIp(request) {
  const ip = request.ip ?? '127.0.0.1'

  return ip.startsWith('::ffff:')
    ? ip.slice(7)
    : ip === '::1'
      ? '127.0.0.1'
      : ip
}

export function createPaymentController({ paymentService }) {
  return {
    async createVnpayPayment(request, response) {
      response
        .status(HTTP_STATUS.CREATED)
        .json(
          await paymentService.createVnpayPayment(
            request.auth.userId,
            request.params.number,
            { ipAddr: clientIp(request) },
          ),
        )
    },

    // VNPay reads only the JSON body, and always expects HTTP 200.
    async vnpayIpn(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await paymentService.handleVnpayIpn(request.query))
    },

    async vnpayReturn(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await paymentService.handleVnpayReturn(
            request.auth.userId,
            request.params.number,
            request.body?.params,
            { ipAddr: clientIp(request) },
          ),
        )
    },

    async listMethods(_request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json({ data: paymentService.isAvailable() ? ['vnpay'] : [] })
    },
  }
}
