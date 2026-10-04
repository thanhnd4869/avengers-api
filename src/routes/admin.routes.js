import { Router } from 'express'
import { USER_ROLE } from '@constants/auth.js'

/**
 * Everything under `/admin` is guarded once here, so a new admin route cannot
 * be added without protection by forgetting a middleware.
 */
export function createAdminRouter({ auth, adminContactMessageController }) {
  const router = Router()

  router.use(
    auth.authenticate,
    auth.authorize(USER_ROLE.ADMIN),
    auth.requireVerifiedEmail,
  )

  router.get(
    '/contact-messages',
    adminContactMessageController.listContactMessages,
  )
  router.patch(
    '/contact-messages/:id',
    adminContactMessageController.updateContactMessageStatus,
  )

  return router
}
