import { Router } from 'express'
import { createHealthController } from '../controllers/health.controller.js'

export function createHealthRouter({ healthService }) {
  const router = Router()
  const controller = createHealthController({ healthService })

  router.get('/health/live', controller.getLiveness)
  router.get('/health/ready', controller.getReadiness)

  return router
}
