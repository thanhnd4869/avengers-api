import { OAUTH_INTENT, USER_ROLE, USER_TOKEN_TYPE } from '#constants/auth.js'
import { ERROR_CODE } from '#constants/error-code.js'
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '#errors/app-error.js'
import { generateToken } from '#utils/token.js'
import {
  parseProvider,
  parseRedirect,
  validateOAuthStartBody,
} from '#validations/oauth.validation.js'

const DISPLAY_NAME_MIN_LENGTH = 2
const DISPLAY_NAME_MAX_LENGTH = 32
const FALLBACK_DISPLAY_NAME = 'Player'

/**
 * Reasons the callback page can show. The provider's own wording never
 * reaches the visitor; these codes are mapped to messages by the client.
 */
export const OAUTH_ERROR = Object.freeze({
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  PROVIDER: 'provider',
  UNAVAILABLE: 'unavailable',
  ACCOUNT_EXISTS: 'account_exists',
  IDENTITY_IN_USE: 'identity_in_use',
  ALREADY_LINKED: 'already_linked',
  REAUTH_MISMATCH: 'reauth_mismatch',
  TRY_AGAIN: 'try_again',
})

class OAuthFlowError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

/** A provider's display name made to fit the rules of a typed one. */
function toDisplayName(name) {
  const cleaned = String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH)
    .trim()

  return cleaned.length >= DISPLAY_NAME_MIN_LENGTH
    ? cleaned
    : FALLBACK_DISPLAY_NAME
}

export function createOAuthService({
  providers,
  flowSigner,
  codeChallengeFor,
  authService,
  userRepository,
  userIdentityRepository,
  userTokenRepository,
  sessionRepository,
  appUrl,
  logger,
}) {
  function providerFor(name) {
    const provider = providers[parseProvider(name)]

    if (!provider) {
      throw new NotFoundError('This sign-in method is not available.')
    }

    return provider
  }

  function callbackUrl(params) {
    return `${appUrl}/oauth/callback?${new URLSearchParams(params)}`
  }

  /**
   * Sign-in or sign-up. A known provider account signs straight in. An
   * address Google verified links to the account that has it; any other
   * address is only ever used once its owner confirms it by email.
   */
  async function signIn(provider, profile, flow, client) {
    const identity = await userIdentityRepository.findIdentity({
      provider: provider.name,
      providerUserId: profile.providerUserId,
    })

    if (identity) {
      const user = await userRepository.findUserById(identity.userId)

      if (user) {
        return authService.startSession(user, {
          persistent: flow.remember,
          client,
        })
      }

      // Left behind by an account deleted mid-way; treat as new.
      await userIdentityRepository.deleteIdentityById(identity._id)
    }

    const existing = profile.email
      ? await userRepository.findUserByEmail(profile.email)
      : null

    if (existing && !profile.emailVerified) {
      // The provider does not vouch for the address, so it cannot open an
      // account that already uses it.
      throw new OAuthFlowError(OAUTH_ERROR.ACCOUNT_EXISTS)
    }

    let user = existing

    if (user && !user.emailVerifiedAt) {
      // Whoever signed up with this address never confirmed it, so the
      // password they chose may not be the owner's. The owner, now proven by
      // Google, takes the account over and everyone else is signed out.
      user = await userRepository.detachPassword(user._id)
      await sessionRepository.deleteUserSession(user._id)
      await userTokenRepository.deleteUserTokens({
        userId: user._id,
        type: USER_TOKEN_TYPE.RESET_PASSWORD,
      })
      await userTokenRepository.deleteUserTokens({
        userId: user._id,
        type: USER_TOKEN_TYPE.CHANGE_EMAIL,
      })
    }

    if (!user) {
      const trusted = profile.email && profile.emailVerified

      try {
        user = await userRepository.createUser({
          email: trusted ? profile.email : null,
          emailVerifiedAt: trusted ? new Date() : null,
          displayName: toDisplayName(profile.name),
          passwordHash: null,
          hasPassword: false,
          role: USER_ROLE.USER,
        })
      } catch (error) {
        if (userRepository.isDuplicateKeyError(error)) {
          // The address was registered between the lookup and now.
          throw new OAuthFlowError(OAUTH_ERROR.TRY_AGAIN)
        }

        throw error
      }

      if (profile.email && !trusted) {
        user = await authService.queueEmailConfirmation(user, profile.email)
      }
    }

    try {
      await userIdentityRepository.createIdentity({
        userId: user._id,
        provider: provider.name,
        providerUserId: profile.providerUserId,
        email: profile.email,
      })
    } catch (error) {
      if (userIdentityRepository.isDuplicateKeyError(error)) {
        throw new OAuthFlowError(OAUTH_ERROR.TRY_AGAIN)
      }

      throw error
    }

    return authService.startSession(user, {
      persistent: flow.remember,
      client,
    })
  }

  /** Attaches the provider account to the signed-in user. */
  async function link(provider, profile, flow) {
    const user = await signedInUser(flow)
    const owner = await userIdentityRepository.findIdentity({
      provider: provider.name,
      providerUserId: profile.providerUserId,
    })

    if (owner) {
      if (String(owner.userId) === String(user._id)) return

      throw new OAuthFlowError(OAUTH_ERROR.IDENTITY_IN_USE)
    }

    if (
      await userIdentityRepository.findUserIdentity({
        userId: user._id,
        provider: provider.name,
      })
    ) {
      throw new OAuthFlowError(OAUTH_ERROR.ALREADY_LINKED)
    }

    try {
      await userIdentityRepository.createIdentity({
        userId: user._id,
        provider: provider.name,
        providerUserId: profile.providerUserId,
        email: profile.email,
      })
    } catch (error) {
      if (userIdentityRepository.isDuplicateKeyError(error)) {
        throw new OAuthFlowError(OAUTH_ERROR.IDENTITY_IN_USE)
      }

      throw error
    }

    // An account still without an address takes the one Google verified,
    // unless another account already uses it.
    if (
      !user.email &&
      profile.email &&
      profile.emailVerified &&
      !(await userRepository.findUserByEmail(profile.email))
    ) {
      try {
        const updated = await userRepository.setVerifiedEmail(
          user._id,
          profile.email,
        )

        if (updated) {
          await sessionRepository.updateSessionClaims(updated._id, {
            emailVerified: true,
          })
        }
      } catch (error) {
        if (!userRepository.isDuplicateKeyError(error)) throw error
      }
    }
  }

  /** Proves the signed-in user is still the owner, for a sensitive change. */
  async function reauthenticate(provider, profile, flow) {
    const user = await signedInUser(flow)
    const identity = await userIdentityRepository.findIdentity({
      provider: provider.name,
      providerUserId: profile.providerUserId,
    })

    if (!identity || String(identity.userId) !== String(user._id)) {
      throw new OAuthFlowError(OAUTH_ERROR.REAUTH_MISMATCH)
    }

    await sessionRepository.markSessionAuthenticated(user._id)
  }

  /**
   * The user who started a link or confirm flow, if that same session is
   * still the live one (not signed out, nor replaced by another device).
   */
  async function signedInUser(flow) {
    const [session, user] = await Promise.all([
      sessionRepository.findSessionByUserId(flow.userId),
      userRepository.findUserById(flow.userId),
    ])

    if (!session || !user || session.id !== flow.sessionId) {
      throw new OAuthFlowError(OAUTH_ERROR.EXPIRED)
    }

    return user
  }

  return {
    listProviders() {
      return { data: Object.keys(providers) }
    },

    /**
     * Prepares the redirect to the provider. The returned flow token goes in
     * an httpOnly cookie; only its random `state` travels through the
     * provider and back.
     */
    async start(providerName, body, auth) {
      const provider = providerFor(providerName)
      const { intent, remember, redirect } = validateOAuthStartBody(body)

      if (intent !== OAUTH_INTENT.LOGIN && !auth) {
        throw new UnauthorizedError()
      }

      const state = generateToken()
      const codeVerifier = provider.usesPkce ? generateToken() : null
      const flowToken = await flowSigner.sign({
        provider: provider.name,
        intent,
        state,
        codeVerifier,
        remember: intent === OAUTH_INTENT.LOGIN && remember,
        redirect,
        userId: auth?.userId ?? null,
        sessionId: auth?.sessionId ?? null,
      })

      return {
        flowToken,
        url: provider.authorizationUrl({
          state,
          codeChallenge: codeVerifier ? codeChallengeFor(codeVerifier) : null,
        }),
      }
    },

    /**
     * Finishes the flow when the provider sends the visitor back. Never
     * throws: every outcome becomes a redirect to the shop, with a session
     * to start when the visitor signed in.
     */
    async callback(providerName, query, flowToken, client) {
      const flow = await flowSigner.verify(flowToken)
      const fallback =
        flow?.intent === OAUTH_INTENT.LOGIN || !flow ? '/' : '/account'
      const next = parseRedirect(flow?.redirect, fallback)
      const fail = (error) =>
        callbackUrl({ error, provider: String(providerName).slice(0, 20) })

      try {
        const provider = providers[providerName]

        if (!provider) throw new OAuthFlowError(OAUTH_ERROR.UNAVAILABLE)

        if (
          !flow ||
          flow.provider !== provider.name ||
          typeof query.state !== 'string' ||
          query.state !== flow.state
        ) {
          throw new OAuthFlowError(OAUTH_ERROR.EXPIRED)
        }

        if (query.error) throw new OAuthFlowError(OAUTH_ERROR.CANCELLED)

        if (typeof query.code !== 'string' || query.code === '') {
          throw new OAuthFlowError(OAUTH_ERROR.PROVIDER)
        }

        let profile

        try {
          profile = await provider.fetchProfile({
            code: query.code,
            codeVerifier: flow.codeVerifier,
          })
        } catch (error) {
          logger.warn({ err: error, provider: provider.name }, 'OAuth failed')
          throw new OAuthFlowError(OAUTH_ERROR.PROVIDER)
        }

        if (flow.intent === OAUTH_INTENT.LINK) {
          await link(provider, profile, flow)

          return {
            redirectTo: callbackUrl({
              status: 'linked',
              provider: provider.name,
              next,
            }),
          }
        }

        if (flow.intent === OAUTH_INTENT.REAUTH) {
          await reauthenticate(provider, profile, flow)

          return {
            redirectTo: callbackUrl({
              status: 'confirmed',
              provider: provider.name,
              next,
            }),
          }
        }

        const session = await signIn(provider, profile, flow, client)

        return {
          session,
          redirectTo: callbackUrl({
            status: 'signed_in',
            provider: provider.name,
            next,
          }),
        }
      } catch (error) {
        if (error instanceof OAuthFlowError) {
          return { redirectTo: fail(error.code) }
        }

        logger.error({ err: error }, 'OAuth callback failed')

        return { redirectTo: fail(OAUTH_ERROR.TRY_AGAIN) }
      }
    },

    async listIdentities(userId) {
      const identities = await userIdentityRepository.listUserIdentities(userId)

      return { data: identities }
    },

    /** Keeps at least one way to sign in: a password or another provider. */
    async unlink(userId, providerName) {
      const provider = parseProvider(providerName)
      const user = await userRepository.findUserById(userId)

      if (!user) throw new UnauthorizedError()

      const identity = await userIdentityRepository.findUserIdentity({
        userId: user._id,
        provider,
      })

      if (!identity) {
        throw new NotFoundError('This sign-in method is not connected.')
      }

      if (
        !user.hasPassword &&
        (await userIdentityRepository.countUserIdentities(user._id)) <= 1
      ) {
        throw new ConflictError(
          'Set a password or connect another account before removing this one, or you could no longer sign in.',
          { code: ERROR_CODE.LAST_SIGN_IN_METHOD },
        )
      }

      await userIdentityRepository.deleteIdentityById(identity._id)

      return this.listIdentities(user._id)
    },
  }
}
