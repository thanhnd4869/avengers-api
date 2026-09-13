import { Router } from 'express'

export function createContactMessageRouter({ contactMessageController }) {
  const router = Router()

  router.post('/', contactMessageController.submitContactMessage)

  return router
}
