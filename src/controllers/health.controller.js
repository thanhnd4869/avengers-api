import { HTTP_STATUS } from '../constants/http-status.js'

export function createHealthController({ healthService }) {
  function getLiveness(_request, response) {
    response.status(HTTP_STATUS.OK).json({
      success: true,
      ...healthService.getLiveness(),
      timestamp: new Date().toISOString(),
    })
  }

  async function getReadiness(_request, response) {
    const { ready, dependencies } = await healthService.getReadiness()

    response
      .status(ready ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE)
      .json({
        success: ready,
        status: ready ? 'ready' : 'not-ready',
        dependencies,
        timestamp: new Date().toISOString(),
      })
  }

  return { getLiveness, getReadiness }
}
