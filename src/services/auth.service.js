import { ERROR_CODE } from '#constants/error-code.js'
import { USER_ROLE, USER_TOKEN_TYPE } from '#constants/auth.js'
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from '#errors/app-error.js'
import { changeEmailEmail } from '#utils/emails/change-email.email.js'
import { resetPasswordEmail } from '#utils/emails/reset-password.email.js'
import { verifyEmailEmail } from '#utils/emails/verify-email.email.js'
import {
  hashPassword,
  verifyAgainstDummy,
  verifyPassword,
} from '#utils/password.js'
import { generateToken, hashToken } from '#utils/token.js'
import { fieldError } from '#validations/query.validation.js'
import {
  validateChangeEmailBody,
  validateChangePasswordBody,
  validateEmailBody,
  validateLoginBody,
  validatePasswordBody,
  validateProfileBody,
  validateRegisterBody,
  validateResetPasswordBody,
  validateTokenBody,
} from '#validations/auth.validation.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const VERIFY_EMAIL_TTL_HOURS = 24
const CHANGE_EMAIL_TTL_HOURS = 24
const RESET_PASSWORD_TTL_MINUTES = 60
const EMAIL_COOLDOWN_SECONDS = 60
// Two tabs refreshing at the same moment present the same token. The one that
// arrives second, within this window, is turned away without being treated as
// a stolen token.
const ROTATION_GRACE_MS = 30 * 1000
const USER_AGENT_MAX_LENGTH = 512
// How long a confirmation with Google or Facebook counts as recent, for an
// account without a password changing its email or deleting itself.
const REAUTH_WINDOW_MS = 10 * 60 * 1000

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

function emailTaken() {
  return new ConflictError('An account with this email already exists.', {
    code: ERROR_CODE.EMAIL_TAKEN,
    details: [
      { field: 'email', message: 'An account with this email already exists.' },
    ],
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

export function createAuthService({
  userRepository,
  sessionRepository,
  userTokenRepository,
  userIdentityRepository,
  cartRepository,
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
      // Kept on the session so a request is authorised from Redis alone.
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
      userAgent: (client.userAgent ?? '').slice(0, USER_AGENT_MAX_LENGTH),
      ip: client.ip ?? '',
      expiresAt: refreshExpiresAt,
    })

    return {
      user,
      accessToken: await accessTokens.sign({
        userId: String(user._id),
        role: user.role,
        sessionId: session.id,
      }),
      refreshToken,
      refreshExpiresAt,
      persistent,
    }
  }

  /** Mirrors a change on the user into the session checked per request. */
  function syncSession(user) {
    return sessionRepository.updateSessionClaims(user._id, {
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    })
  }

  async function sendTokenEmail(
    user,
    { type, ttlMs, path, render, to = user.email, email = null },
  ) {
    const token = generateToken()

    await userTokenRepository.replaceUserToken({
      userId: user._id,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
      email,
    })

    // Every link sent starts the wait before the next one of its kind, the
    // one sent at sign-up included, so "resend" cannot replace it at once.
    await userTokenRepository.startEmailCooldown({
      userId: user._id,
      type,
      seconds: EMAIL_COOLDOWN_SECONDS,
    })

    const url = `${appUrl}${path}?token=${encodeURIComponent(token)}`

    await mailer.send({ to, ...render(url) })
  }

  /**
   * Loads the signed-in user and makes sure it is really them before a
   * sensitive change: the password typed again, or, for an account without
   * one, a recent confirmation with Google or Facebook.
   */
  async function confirmIdentity(
    { userId, sessionId },
    password,
    field = 'password',
  ) {
    const user = await userRepository.findUserByIdWithPassword(userId)

    if (!user) {
      throw sessionRevoked()
    }

    if (!user.passwordHash) {
      const session = await sessionRepository.findSessionByUserId(userId)
      const confirmedAt =
        session?.id === sessionId
          ? (session.authenticatedAt?.getTime() ?? 0)
          : 0

      if (Date.now() - confirmedAt > REAUTH_WINDOW_MS) {
        throw new ForbiddenError(
          'Please confirm it is you with Google or Facebook first.',
          { code: ERROR_CODE.REAUTH_REQUIRED },
        )
      }

      return user
    }

    if (password === null) {
      throw fieldError(field, 'Please enter your password.')
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      // 400 rather than 401: the session is fine, and a 401 would make the
      // client try to refresh it.
      throw fieldError(field, 'The password is incorrect.')
    }

    return user
  }

  /**
   * Claims the next email of this kind for the user, or throws 429 while the
   * previous one is too recent.
   */
  async function ensureEmailCooldown(userId, type) {
    const wait = await userTokenRepository.startEmailCooldown({
      userId,
      type,
      seconds: EMAIL_COOLDOWN_SECONDS,
    })

    if (wait > 0) {
      throw new TooManyRequestsError(
        `Please wait ${wait} seconds before requesting another email.`,
        { details: [{ field: 'retryAfter', message: String(wait) }] },
      )
    }
  }

  /** Mails the link that confirms `email` as the account's address. */
  function sendEmailChangeLink(user, email) {
    return sendTokenEmail(user, {
      type: USER_TOKEN_TYPE.CHANGE_EMAIL,
      ttlMs: CHANGE_EMAIL_TTL_HOURS * HOUR,
      path: '/confirm-email',
      to: email,
      email,
      render: (url) =>
        changeEmailEmail({
          displayName: user.displayName,
          email,
          url,
          ttlHours: CHANGE_EMAIL_TTL_HOURS,
        }),
    })
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

  return {
    /** Signs a user in; used by sign-in with Google or Facebook as well. */
    startSession: issueSession,

    /**
     * Records `email` as waiting and mails it a confirmation link, without
     * the cooldown: used once, for the address Facebook shared at sign-up.
     */
    async queueEmailConfirmation(user, email) {
      const updated = await userRepository.setPendingEmail(user._id, email)

      try {
        await sendEmailChangeLink(updated, email)
      } catch (error) {
        logger.error({ err: error }, 'Could not send the confirmation email')
      }

      return updated
    },

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
          throw emailTaken()
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

      // An account that signs in with Google or Facebook only has no hash,
      // and is answered exactly like an unknown address.
      if (!user?.passwordHash) {
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
          await sessionRepository.deleteUserSession(rotated.userId)
          throw sessionRevoked()
        }

        throw invalidRefreshToken()
      }

      const user = await userRepository.findUserById(session.userId)

      if (!user) {
        await sessionRepository.deleteUserSession(session.userId)
        throw invalidRefreshToken()
      }

      const nextToken = generateToken()
      // A remembered session slides forward; a browser-session one keeps its
      // original end, so it cannot be kept alive forever by an open tab.
      const refreshExpiresAt = session.persistent
        ? new Date(Date.now() + refreshTokenTtlDays * DAY)
        : session.expiresAt

      const rotated = await sessionRepository.rotateRefreshToken({
        userId: session.userId,
        currentHash,
        nextHash: hashToken(nextToken),
        expiresAt: refreshExpiresAt,
      })

      if (!rotated) {
        // Lost a race with a concurrent refresh of the same token.
        throw invalidRefreshToken()
      }

      // The user is read here anyway, so the session's copy of the claims is
      // brought up to date at every refresh.
      await syncSession(user)

      return {
        user,
        accessToken: await accessTokens.sign({
          userId: String(user._id),
          role: user.role,
          sessionId: session.id,
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
        await sessionRepository.deleteUserSession(session.userId)
      }
    },

    /**
     * Resolves a bearer token to the signed-in identity, or throws 401. One
     * Redis read per request: the session holds the role and verified flag,
     * kept in step with the user, so a sign-in elsewhere, a sign-out, a role
     * change or a deleted account applies at once without touching MongoDB.
     */
    async authenticateAccessToken(accessToken) {
      const claims = accessToken ? await accessTokens.verify(accessToken) : null

      if (!claims) {
        throw new UnauthorizedError('Authentication required', {
          code: ERROR_CODE.INVALID_TOKEN,
        })
      }

      const session = await sessionRepository.findSessionByUserId(claims.userId)

      if (!session) {
        // Signed out, expired, or the account was deleted.
        throw new UnauthorizedError('Your session has ended.', {
          code: ERROR_CODE.SESSION_ENDED,
        })
      }

      if (session.id !== claims.sessionId) {
        // The user's one session belongs to a newer sign-in elsewhere.
        throw sessionRevoked()
      }

      return {
        userId: session.userId,
        role: session.role,
        sessionId: session.id,
        emailVerified: session.emailVerified,
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

      await syncSession(user)

      return { data: user }
    },

    async resendVerificationEmail(userId) {
      const user = await userRepository.findUserById(userId)

      if (!user) {
        throw sessionRevoked()
      }

      if (!user.email) {
        throw new BadRequestError('Add an email address first.', {
          code: ERROR_CODE.NO_EMAIL,
        })
      }

      if (user.emailVerifiedAt) {
        throw new ConflictError('This email address is already verified.', {
          code: ERROR_CODE.EMAIL_ALREADY_VERIFIED,
        })
      }

      await ensureEmailCooldown(user._id, USER_TOKEN_TYPE.VERIFY_EMAIL)
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
        (await userTokenRepository.startEmailCooldown({
          userId: user._id,
          type: USER_TOKEN_TYPE.RESET_PASSWORD,
          seconds: EMAIL_COOLDOWN_SECONDS,
        })) > 0
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
      await sessionRepository.deleteUserSession(used.userId)
      // Following the link proves the visitor reads this inbox.
      await userRepository.markEmailVerified(used.userId)

      return {
        data: {
          success: true,
          message: 'Your password was changed. Please sign in again.',
        },
      }
    },

    async updateProfile(userId, body) {
      const { displayName } = validateProfileBody(body)
      const user = await userRepository.updateDisplayName(userId, displayName)

      if (!user) {
        throw sessionRevoked()
      }

      return { data: user }
    },

    /**
     * Keeps this device signed in under a new session. Every other device,
     * and any token issued before, stops working, as does an unused reset
     * link that would otherwise undo the change.
     */
    async changePassword({ userId, sessionId }, body, client) {
      const { currentPassword, newPassword } = validateChangePasswordBody(body)
      const user = await userRepository.findUserByIdWithPassword(userId)

      if (!user) {
        throw sessionRevoked()
      }

      // An account without a password sets its first one through a link
      // mailed by "forgot password", which proves it owns the address.
      if (
        !user.passwordHash ||
        !(await verifyPassword(currentPassword, user.passwordHash))
      ) {
        throw fieldError('currentPassword', 'The password is incorrect.')
      }

      const session = await sessionRepository.findSessionByUserId(userId)
      const persistent = session?.id === sessionId && session.persistent

      await userRepository.updatePasswordHash(
        user._id,
        await hashPassword(newPassword),
      )
      await userTokenRepository.deleteUserTokens({
        userId: user._id,
        type: USER_TOKEN_TYPE.RESET_PASSWORD,
      })

      return issueSession(user, { persistent, client })
    },

    /**
     * Mails a link to the new address. The account keeps the current one
     * until that link is followed, so a typo cannot lock its owner out.
     */
    async requestEmailChange(auth, body) {
      const { email, password } = validateChangeEmailBody(body)
      const user = await confirmIdentity(auth, password)

      if (email === user.email) {
        throw fieldError('email', 'This is already your email address.')
      }

      if (await userRepository.findUserByEmail(email)) {
        throw emailTaken()
      }

      await ensureEmailCooldown(user._id, USER_TOKEN_TYPE.CHANGE_EMAIL)

      const updated = await userRepository.setPendingEmail(user._id, email)

      await sendEmailChangeLink(user, email)

      return { data: updated }
    },

    /**
     * Sends the link for the address already waiting, again. Needs no
     * password: it can only confirm the address the owner already chose,
     * such as the one Facebook shared at sign-up.
     */
    async resendEmailChange(userId) {
      const user = await userRepository.findUserById(userId)

      if (!user) {
        throw sessionRevoked()
      }

      if (!user.pendingEmail) {
        throw new BadRequestError('There is no email address to confirm.')
      }

      await ensureEmailCooldown(user._id, USER_TOKEN_TYPE.CHANGE_EMAIL)
      await sendEmailChangeLink(user, user.pendingEmail)

      return { data: user }
    },

    async cancelEmailChange(userId) {
      await userTokenRepository.deleteUserTokens({
        userId,
        type: USER_TOKEN_TYPE.CHANGE_EMAIL,
      })
      const user = await userRepository.setPendingEmail(userId, null)

      if (!user) {
        throw sessionRevoked()
      }

      return { data: user }
    },

    async confirmEmailChange(body) {
      const { token } = validateTokenBody(body)
      const used = await userTokenRepository.consumeUserToken({
        type: USER_TOKEN_TYPE.CHANGE_EMAIL,
        tokenHash: hashToken(token),
      })

      if (!used?.email) {
        throw invalidLink()
      }

      let user

      try {
        user = await userRepository.applyPendingEmail(used.userId, used.email)
      } catch (error) {
        // Someone signed up with the address after the link was sent.
        if (userRepository.isDuplicateKeyError(error)) {
          await userRepository.setPendingEmail(used.userId, null)
          throw emailTaken()
        }

        throw error
      }

      if (!user) {
        throw invalidLink()
      }

      // Links mailed to the old address must not act on the account anymore.
      await Promise.all([
        userTokenRepository.deleteUserTokens({
          userId: user._id,
          type: USER_TOKEN_TYPE.RESET_PASSWORD,
        }),
        userTokenRepository.deleteUserTokens({
          userId: user._id,
          type: USER_TOKEN_TYPE.VERIFY_EMAIL,
        }),
      ])
      await syncSession(user)

      return { data: user }
    },

    async deleteAccount(auth, body) {
      const { password } = validatePasswordBody(body)
      const user = await confirmIdentity(auth, password)

      // Admins are managed with `npm run create-admin`; deleting the last one
      // from a browser would leave nobody able to run the shop.
      if (user.role === USER_ROLE.ADMIN) {
        throw new ForbiddenError(
          'Administrator accounts cannot be deleted from the account page.',
        )
      }

      const tokenTypes = Object.values(USER_TOKEN_TYPE)

      await sessionRepository.deleteUserSession(user._id)
      await userTokenRepository.deleteAllUserTokens(user._id, tokenTypes)
      await userTokenRepository.clearEmailCooldowns(user._id, tokenTypes)
      await userIdentityRepository.deleteUserIdentities(user._id)
      await cartRepository.deleteCart(user._id)
      await userRepository.deleteUserById(user._id)
    },
  }
}
