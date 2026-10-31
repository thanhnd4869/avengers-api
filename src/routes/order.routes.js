import { Router } from 'express'

export function createOrderRouter({ orderController, auth }) {
  const router = Router()

  router.use(auth.authenticate)
  router.post('/', orderController.createOrder)
  router.get('/', orderController.listOrders)
  // Before `/:number`, which would otherwise take "pending" as a number.
  router.get('/pending', orderController.getPendingOrder)
  router.get('/:number', orderController.getOrder)
  router.post('/:number/cancel', orderController.cancelOrder)

  return router
}
