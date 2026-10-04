import { ERROR_CODE } from '@constants/error-code.js'
import { USER_ROLE, USER_TOKEN_TYPE } from '@constants/auth.js'
import {
  BadRequestError,
  ConflictError,
  TooManyRequestsError,
  UnauthorizedError,
} from '@errors/app-error.js'
import { resetPasswordEmail } from '@utils/emails/reset-password.email.js'
import { verifyEmailEmail } from '@utils/emails/verify-email.email.js'
import {
  hashPassword,
  verifyAgainstDummy,
  verifyPassword,
} from '@utils/password.js'
import { generateToken, hashToken } from '@utils/token.js'
import {
  validateEmailBody,
  validateLoginBody,
  validateRegisterBody,
  validateResetPasswordBody,
  validateTokenBody,
} from '@validations/auth.validation.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const VERIFY_EMAIL_TTL_HOURS = 24
const RESET_PASSWORD_TTL_MINUTES = 60
const EMAIL_COOLDOWN_SECONDS = 60
// Two tabs refreshing at the same moment present the same token. The one that
// arrives second, within this window, is turned away without being treated as
// a stolen token.
const ROTATION_GRACE_MS = 30 * 1000
const USER_AGENT_MAX_LENGTH = 512

const FORGOT_PASSWORD_REPLY = Object.freeze({
  data: {
    success: true,
    message:
      'If an account exists for this email, a link to reset the password has been sent.',
  },
})

function invalidCredentials() {
  // One message for both a wrong email and a wrong password, so the response
  // does not reveal which addresses have an account.
  return new UnauthorizedError('Incorrect email or password.', {
    code: ERROR_CODE.INVALID_CREDENTIALS,
  })
}

function invalidLink() {
  return new BadRequestError('The link is invalid or has expired.', {
    code: ERROR_CODE.INVALID_TOKEN,
  })
}

function sessionRevoked() {
  return new UnauthorizedError(
    'Your session has ended because the account signed in on another device.',
    { code: ERROR_CODE.SESSION_REVOKED },
  )
}

function invalidRefreshToken() {
  return new UnauthorizedError('Please sign in again.', {
    code: ERROR_CODE.INVALID_TOKEN,
  })
}

function secondsSince(date) {
  return (Date.now() - date.getTime()) / 1000
}

export function createAuthService({
  userRepository,
  sessionRepository,
  userTokenRepository,
  accessTokens,
  mailer,
  logger,
  appUrl,
  refreshTokenTtlDays,
}) {
  async function issueSession(user, { persistent, client }) {
    const refreshToken = generateToken()
    const refreshExpiresAt = new Date(Date.now() + refreshTokenTtlDays * DAY)

    const session = await sessionRepository.replaceUserSession({
      userId: user._id,
      refreshTokenHash: hashToken(refreshToken),
      persistent,
      userAgent: (client.userAgent ?? '').slice(0, USER_AGENT_MAX_LENGTH),
      ip: client.ip ?? '',
      expiresAt: refreshExpiresAt,
    })

    return {
      user,
      accessToken: await accessTokens.sign({
        userId: String(user._id),
        role: user.role,
        sessionId: String(session._id),
      }),
      refreshToken,
      refreshExpiresAt,
      persistent,
    }
  }

  async function sendTokenEmail(user, { type, ttlMs, path, render }) {
    const token = generateToken()

    await userTokenRepository.replaceUserToken({
      userId: user._id,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
    })

    const url = `${appUrl}${path}?token=${encodeURIComponent(token)}`

    await mailer.send({ to: user.email, ...render(url) })
  }

  function sendVerificationEmail(user) {
    return sendTokenEmail(user, {
      type: USER_TOKEN_TYPE.VERIFY_EMAIL,
      ttlMs: VERIFY_EMAIL_TTL_HOURS * HOUR,
      path: '/verify-email',
      render: (url) =>
        verifyEmailEmail({
          displayName: user.displayName,
          url,
          ttlHours: VERIFY_EMAIL_TTL_HOURS,
        }),
    })
  }

  async function secondsUntilResendAllowed(userId, type) {
    const latest = await userTokenRepository.findLatestUserToken({
      userId,
      type,
    })

    if (!latest) return 0

    return Math.max(
      0,
      Math.ceil(EMAIL_COOLDOWN_SECONDS - secondsSince(latest.createdAt)),
    )
  }

  return {
    async register(body, client) {
      const { displayName, email, password } = validateRegisterBody(body)
      let user

      try {
        user = await userRepository.createUser({
          displayName,
          email,
          passwordHash: await hashPassword(password),
          // Never taken from the request: admins are made by a script only.
          role: USER_ROLE.USER,
        })
      } catch (error) {
        if (userRepository.isDuplicateKeyError(error)) {
          throw new ConflictError(
            'An account with this email already exists.',
            {
              code: ERROR_CODE.EMAIL_TAKEN,
              details: [
                {
                  field: 'email',
                  message: 'An account with this email already exists.',
                },
              ],
            },
          )
        }

        throw error
      }

      // The account exists either way; a mail outage must not fail sign-up.
      // The visitor can ask for another email once signed in.
      try {
        await sendVerificationEmail(user)
      } catch (error) {
        logger.error({ err: error }, 'Could not send the verification email')
      }

      return issueSession(user, { persistent: false, client })
    },

    async login(body, client) {
      const { email, password, remember } = validateLoginBody(body)
      const user = await userRepository.findUserByEmailWithPassword(email)

      if (!user) {
        await verifyAgainstDummy(password)
        throw invalidCredentials()
      }

      if (!(await verifyPassword(password, user.passwordHash))) {
        throw invalidCredentials()
      }

      return issueSession(user, { persistent: remember, client })
    },

    async refresh(refreshToken) {
      // A distinct code from a rejected token: no cookie simply means a
      // visitor who never signed in, and the client need not retry.
      if (!refreshToken) {
        throw new UnauthorizedError('Not signed in.')
      }

      const currentHash = hashToken(refreshToken)
      const session =
        await sessionRepository.findSessionByRefreshTokenHash(currentHash)

      if (!session) {
        const rotated =
          await sessionRepository.findSessionByPreviousRefreshTokenHash(
            currentHash,
          )

        if (
          rotated &&
          rotated.rotatedAt &&
          Date.now() - rotated.rotatedAt.getTime() > ROTATION_GRACE_MS
        ) {
          // An old token came back long after it was replaced: someone else
          // holds a copy. Ending the session locks out both parties.
          await sessionRepository.deleteSessionById(rotated._id)
          throw sessionRevoked()
        }

        throw invalidRefreshToken()
      }

      if (session.expiresAt.getTime() <= Date.now()) {
        throw invalidRefreshToken()
      }

      const user = await userRepository.findUserById(session.userId)

      if (!user) {
        await sessionRepository.deleteSessionById(session._id)
        throw invalidRefreshToken()
      }

      const nextToken = generateToken()
      // A remembered session slides forward; a browser-session one keeps its
      // original end, so it cannot be kept alive forever by an open tab.
      const refreshExpiresAt = session.persistent
        ? new Date(Date.now() + refreshTokenTtlDays * DAY)
        : session.expiresAt

      const rotated = await sessionRepository.rotateRefreshToken({
        sessionId: session._id,
        currentHash,
        nextHash: hashToken(nextToken),
        expiresAt: refreshExpiresAt,
      })

      if (!rotated) {
        // Lost a race with a concurrent refresh of the same token.
        throw invalidRefreshToken()
      }

      return {
        user,
        accessToken: await accessTokens.sign({
          userId: String(user._id),
          role: user.role,
          sessionId: String(session._id),
        }),
        refreshToken: nextToken,
        refreshExpiresAt,
        persistent: session.persistent,
      }
    },

    async logout(refreshToken) {
      if (!refreshToken) return

      const session = await sessionRepository.findSessionByRefreshTokenHash(
        hashToken(refreshToken),
      )

      if (session) {
        await sessionRepository.deleteSessionById(session._id)
      }
    },

    /**
     * Resolves a bearer token to the signed-in identity, or throws 401. Reads
     * the session and the user on every call, so a sign-in elsewhere, a role
     * change or a password reset takes effect immediately.
     */
    async authenticateAccessToken(accessToken) {
      const claims = accessToken ? await accessTokens.verify(accessToken) : null

      if (!claims) {
        throw new UnauthorizedError('Authentication required', {
          code: ERROR_CODE.INVALID_TOKEN,
        })
      }

      const [session, user] = await Promise.all([
        sessionRepository.findActiveSessionById(claims.sessionId),
        userRepository.findUserById(claims.userId),
      ])

      if (!user) {
        throw sessionRevoked()
      }

      if (!session || String(session.userId) !== String(user._id)) {
        // Only a newer live session means another device took over. Otherwise
        // the session was signed out or ran out, and the client must not tell
        // the visitor someone else signed in.
        if (await sessionRepository.findActiveSessionByUserId(user._id)) {
          throw sessionRevoked()
        }

        throw new UnauthorizedError('Your session has ended.', {
          code: ERROR_CODE.SESSION_ENDED,
        })
      }

      return {
        userId: String(user._id),
        role: user.role,
        sessionId: String(session._id),
        emailVerified: user.emailVerifiedAt !== null,
      }
    },

    async getCurrentUser(userId) {
      const user = await userRepository.findUserById(userId)

      if (!user) {
        throw sessionRevoked()
      }

      return { data: user }
    },

    async verifyEmail(body) {
      const { token } = validateTokenBody(body)
      const used = await userTokenRepository.consumeUserToken({
        type: USER_TOKEN_TYPE.VERIFY_EMAIL,
        tokenHash: hashToken(token),
      })

      if (!used) {
        throw invalidLink()
      }

      const user =
        (await userRepository.markEmailVerified(used.userId)) ??
        (await userRepository.findUserById(used.userId))

      if (!user) {
        throw invalidLink()
      }

      return { data: user }
    },

    async resendVerificationEmail(userId) {
      const user = await userRepository.findUserById(userId)

      if (!user) {
        throw sessionRevoked()
      }

      if (user.emailVerifiedAt) {
        throw new ConflictError('This email address is already verified.', {
          code: ERROR_CODE.EMAIL_ALREADY_VERIFIED,
        })
      }

      const wait = await secondsUntilResendAllowed(
        user._id,
        USER_TOKEN_TYPE.VERIFY_EMAIL,
      )

      if (wait > 0) {
        throw new TooManyRequestsError(
          `Please wait ${wait} seconds before requesting another email.`,
          { details: [{ field: 'retryAfter', message: String(wait) }] },
        )
      }

      await sendVerificationEmail(user)

      return {
        data: { success: true, message: 'A new verification email was sent.' },
      }
    },

    async forgotPassword(body) {
      const { email } = validateEmailBody(body)
      const user = await userRepository.findUserByEmail(email)

      // Unknown addresses and the cooldown get the same reply as a success,
      // so this endpoint cannot be used to discover accounts.
      if (
        !user ||
        (await secondsUntilResendAllowed(
          user._id,
          USER_TOKEN_TYPE.RESET_PASSWORD,
        )) > 0
      ) {
        return FORGOT_PASSWORD_REPLY
      }

      await sendTokenEmail(user, {
        type: USER_TOKEN_TYPE.RESET_PASSWORD,
        ttlMs: RESET_PASSWORD_TTL_MINUTES * 60 * 1000,
        path: '/reset-password',
        render: (url) =>
          resetPasswordEmail({
            displayName: user.displayName,
            url,
            ttlMinutes: RESET_PASSWORD_TTL_MINUTES,
          }),
      })

      return FORGOT_PASSWORD_REPLY
    },

    async resetPassword(body) {
      const { token, password } = validateResetPasswordBody(body)
      const used = await userTokenRepository.consumeUserToken({
        type: USER_TOKEN_TYPE.RESET_PASSWORD,
        tokenHash: hashToken(token),
      })

      if (!used) {
        throw invalidLink()
      }

      await userRepository.updatePasswordHash(
        used.userId,
        await hashPassword(password),
      )
      // Whoever knew the old password is signed out everywhere.
      await sessionRepository.deleteSessionsByUserId(used.userId)
      // Following the link proves the visitor reads this inbox.
      await userRepository.markEmailVerified(used.userId)

      return {
        data: {
          success: true,
          message: 'Your password was changed. Please sign in again.',
        },
      }
    },
  }
}
