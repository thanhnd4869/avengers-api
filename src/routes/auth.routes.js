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

  return router
}
