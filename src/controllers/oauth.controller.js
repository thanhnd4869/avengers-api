import { API_PREFIX } from '@constants/api.js'
import { OAUTH_FLOW_COOKIE_NAME } from '@constants/auth.js'
import { HTTP_STATUS } from '@constants/http-status.js'
import { readCookie } from '@utils/cookie.js'

function clientOf(request) {
  return { ip: request.ip, userAgent: request.get('user-agent') }
}

export function createOAuthController({
  oauthService,
  setRefreshCookie,
  isProduction,
  flowTtlSeconds,
}) {
  const flowCookieOptions = {
    httpOnly: true,
    // Lax is what lets the cookie come back on the provider's top-level
    // redirect to the callback, while no cross-site request can carry it.
    sameSite: 'lax',
    secure: isProduction,
    path: `${API_PREFIX}/auth/oauth`,
  }

  return {
    listProviders(_request, response) {
      response.status(HTTP_STATUS.OK).json(oauthService.listProviders())
    },

    async start(request, response) {
      const { flowToken, url } = await oauthService.start(
        request.params.provider,
        request.body,
        request.auth,
      )

      response.cookie(OAUTH_FLOW_COOKIE_NAME, flowToken, {
        ...flowCookieOptions,
        maxAge: flowTtlSeconds * 1000,
      })
      response.status(HTTP_STATUS.OK).json({ data: { url } })
    },

    async callback(request, response) {
      const { session, redirectTo } = await oauthService.callback(
        request.params.provider,
        request.query,
        readCookie(request.headers.cookie, OAUTH_FLOW_COOKIE_NAME),
        clientOf(request),
      )

      // One use only, whatever the outcome.
      response.clearCookie(OAUTH_FLOW_COOKIE_NAME, flowCookieOptions)

      if (session) {
        setRefreshCookie(response, session)
      }

      response.redirect(HTTP_STATUS.FOUND, redirectTo)
    },

    async listIdentities(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await oauthService.listIdentities(request.auth.userId))
    },

    async unlink(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await oauthService.unlink(
            request.auth.userId,
            request.params.provider,
          ),
        )
    },
  }
}
