import { Router } from 'express'
import { getHome } from '../controllers/home.controller.js'

export function createHomeRouter() {
  const router = Router()

  router.get('/', getHome)

  return router
}
