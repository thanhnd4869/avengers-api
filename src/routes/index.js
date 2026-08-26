import { Router } from 'express'
import { createHomeRouter } from './home.routes.js'

export function createRouter() {
  const router = Router()

  router.use(createHomeRouter())

  return router
}
