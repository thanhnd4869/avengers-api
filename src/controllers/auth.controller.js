import { API_PREFIX } from '@constants/api.js'
import { REFRESH_COOKIE_NAME } from '@constants/auth.js'
import { HTTP_STATUS } from '@constants/http-status.js'
import { readCookie } from '@utils/cookie.js'

function clientOf(request) {
  return { ip: request.ip, userAgent: request.get('user-agent') }
}

function readRefreshToken(request) {
  return readCookie(request.headers.cookie, REFRESH_COOKIE_NAME)
}

export function createAuthController({ authService, isProduction }) {
  const cookieOptions = {
    httpOnly: true,
    // Lax still sends the cookie on top-level navigation from a mail client,
    // while a cross-site form or fetch never carries it.
    sameSite: 'lax',
    secure: isProduction,
    path: `${API_PREFIX}/auth`,
  }

  function sendSession(response, status, result) {
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...cookieOptions,
      // Without `expires` the browser drops the cookie when it closes.
      ...(result.persistent ? { expires: result.refreshExpiresAt } : {}),
    })

    response.status(status).json({
      data: { user: result.user, accessToken: result.accessToken },
    })
  }

  return {
    async register(request, response) {
      sendSession(
        response,
        HTTP_STATUS.CREATED,
        await authService.register(request.body, clientOf(request)),
      )
    },

    async login(request, response) {
      sendSession(
        response,
        HTTP_STATUS.OK,
        await authService.login(request.body, clientOf(request)),
      )
    },

    async refresh(request, response) {
      // A failed refresh leaves the cookie alone: another tab may have just
      // rotated it, and clearing it here would sign that tab out too.
      sendSession(
        response,
        HTTP_STATUS.OK,
        await authService.refresh(readRefreshToken(request)),
      )
    },

    async logout(request, response) {
      await authService.logout(readRefreshToken(request))
      response.clearCookie(REFRESH_COOKIE_NAME, cookieOptions)
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },

    async me(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await authService.getCurrentUser(request.auth.userId))
    },

    async verifyEmail(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await authService.verifyEmail(request.body))
    },

    async resendVerificationEmail(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await authService.resendVerificationEmail(request.auth.userId))
    },

    async forgotPassword(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await authService.forgotPassword(request.body))
    },

    async resetPassword(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await authService.resetPassword(request.body))
    },

    async updateProfile(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await authService.updateProfile(request.auth.userId, request.body),
        )
    },

    async changePassword(request, response) {
      sendSession(
        response,
        HTTP_STATUS.OK,
        await authService.changePassword(
          request.auth,
          request.body,
          clientOf(request),
        ),
      )
    },

    async requestEmailChange(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(
          await authService.requestEmailChange(
            request.auth.userId,
            request.body,
          ),
        )
    },

    async cancelEmailChange(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await authService.cancelEmailChange(request.auth.userId))
    },

    async confirmEmailChange(request, response) {
      response
        .status(HTTP_STATUS.OK)
        .json(await authService.confirmEmailChange(request.body))
    },

    async deleteAccount(request, response) {
      await authService.deleteAccount(request.auth.userId, request.body)
      response.clearCookie(REFRESH_COOKIE_NAME, cookieOptions)
      response.status(HTTP_STATUS.NO_CONTENT).end()
    },
  }
}
