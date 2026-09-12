import { Router } from 'express'

export function createHomeRouter({ homeController }) {
  const router = Router()

  router.get('/', homeController.getHome)

  return router
}
