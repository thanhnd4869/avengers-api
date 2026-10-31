import { Router } from 'express'

/** Mounted at `/payments`: what VNPay and the checkout page call. */
export function createPaymentRouter({ paymentController }) {
  const router = Router()

  router.get('/methods', paymentController.listMethods)
  // Called by VNPay's servers, not by a browser; authenticated by its
  // signature alone.
  router.get('/vnpay/ipn', paymentController.vnpayIpn)

  return router
}

/** Mounted under `/orders/:number`, next to the order they pay for. */
export function createOrderPaymentRouter({
  paymentController,
  auth,
  rateLimit,
}) {
  const router = Router({ mergeParams: true })

  router.use(auth.authenticate)
  router.post('/vnpay', rateLimit, paymentController.createVnpayPayment)
  router.post('/vnpay/return', paymentController.vnpayReturn)

  return router
}
