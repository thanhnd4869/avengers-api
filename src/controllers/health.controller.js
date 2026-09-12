import { HTTP_STATUS } from '@constants/http-status.js'

export function createHealthController({ healthService }) {
  function getLiveness(_request, response) {
    response.status(HTTP_STATUS.OK).json({
      success: true,
      ...healthService.getLiveness(),
    })
  }

  async function getReadiness(_request, response) {
    const { ready, ...health } = await healthService.getReadiness()

    response
      .status(ready ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE)
      .json({ success: ready, ...health })
  }

  return { getLiveness, getReadiness }
}
