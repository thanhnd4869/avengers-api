import { Router } from 'express'

export function createCartRouter({ cartController, auth }) {
  const router = Router()

  // A guest cart lives in the browser; this prices it without storing it.
  router.post('/preview', cartController.previewCart)

  router.use(auth.authenticate)
  router.get('/', cartController.getCart)
  router.delete('/', cartController.clearCart)
  router.post('/items', cartController.addItem)
  router.patch('/items/:variantId', cartController.setQuantity)
  router.delete('/items/:variantId', cartController.removeItem)
  router.post('/merge', cartController.mergeCart)

  return router
}
