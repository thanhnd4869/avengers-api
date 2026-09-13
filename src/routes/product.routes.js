import { Router } from 'express'

export function createProductRouter({ productController }) {
  const router = Router()

  router.get('/', productController.listProducts)

  return router
}
