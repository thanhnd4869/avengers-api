import { Router } from 'express'

export function createHealthRouter({ healthController }) {
  const router = Router()

  router.get('/health/live', healthController.getLiveness)
  router.get('/health/ready', healthController.getReadiness)

  return router
}
