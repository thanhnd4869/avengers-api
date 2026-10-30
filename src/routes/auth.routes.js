import { Router } from 'express'

export function createAuthRouter({ authController, auth, rateLimits }) {
  const router = Router()

  router.post('/register', rateLimits.register, authController.register)
  router.post('/login', rateLimits.login, authController.login)
  router.post('/refresh', authController.refresh)
  router.post('/logout', authController.logout)
  router.get('/me', auth.authenticate, authController.me)
  router.post('/verify-email', authController.verifyEmail)
  router.post(
    '/verify-email/resend',
    rateLimits.email,
    auth.authenticate,
    authController.resendVerificationEmail,
  )
  router.post(
    '/forgot-password',
    rateLimits.email,
    authController.forgotPassword,
  )
  router.post('/reset-password', authController.resetPassword)

  router.patch('/me', auth.authenticate, authController.updateProfile)
  router.delete(
    '/me',
    rateLimits.login,
    auth.authenticate,
    authController.deleteAccount,
  )
  // Both ask for the current password, so they share the sign-in budget.
  router.post(
    '/change-password',
    rateLimits.login,
    auth.authenticate,
    authController.changePassword,
  )
  router.post(
    '/change-email',
    rateLimits.email,
    auth.authenticate,
    authController.requestEmailChange,
  )
  router.delete(
    '/change-email',
    auth.authenticate,
    authController.cancelEmailChange,
  )
  router.post('/change-email/confirm', authController.confirmEmailChange)

  return router
}
