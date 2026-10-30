import { createHash, createHmac } from 'node:crypto'
import { API_PREFIX } from '@constants/api.js'
import { OAUTH_PROVIDER } from '@constants/auth.js'

const FACEBOOK_GRAPH_VERSION = 'v26.0'
const REQUEST_TIMEOUT_MS = 10_000

export class OAuthProviderError extends Error {
  constructor(message, { cause } = {}) {
    super(message, { cause })
    this.name = 'OAuthProviderError'
  }
}

/** RFC 7636 S256 challenge for a PKCE verifier. */
export function codeChallengeFor(verifier) {
  return createHash('sha256').update(verifier).digest('base64url')
}

async function requestJson(url, init = {}) {
  let response

  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (cause) {
    throw new OAuthProviderError(`Could not reach ${new URL(url).host}`, {
      cause,
    })
  }

  const body = await response.json().catch(() => null)

  if (!response.ok || !body) {
    throw new OAuthProviderError(
      `${new URL(url).host} answered ${response.status}`,
    )
  }

  return body
}

/**
 * Google, as an OpenID Connect provider with PKCE. Google states whether it
 * verified the address, which decides if the account may be linked by email.
 */
function createGoogleProvider({
  clientId,
  clientSecret,
  redirectUri,
  mockUrl,
}) {
  const urls = mockUrl
    ? {
        auth: `${mockUrl}/google/auth`,
        token: `${mockUrl}/google/token`,
        userinfo: `${mockUrl}/google/userinfo`,
      }
    : {
        auth: 'https://accounts.google.com/o/oauth2/v2/auth',
        token: 'https://oauth2.googleapis.com/token',
        userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
      }

  return {
    name: OAUTH_PROVIDER.GOOGLE,
    usesPkce: true,

    authorizationUrl({ state, codeChallenge }) {
      const url = new URL(urls.auth)

      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        // Lets someone signed in to several Google accounts pick one.
        prompt: 'select_account',
      })

      return url.href
    },

    async fetchProfile({ code, codeVerifier }) {
      const token = await requestJson(urls.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
      })

      const info = await requestJson(urls.userinfo, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })

      if (typeof info.sub !== 'string' || info.sub === '') {
        throw new OAuthProviderError('Google returned no account id')
      }

      return {
        providerUserId: info.sub,
        email: typeof info.email === 'string' ? info.email.toLowerCase() : null,
        emailVerified: info.email_verified === true,
        name: typeof info.name === 'string' ? info.name : '',
      }
    },
  }
}

/**
 * Facebook Login. Facebook does not say whether it verified an address, so
 * its email is never trusted to link or claim an account by itself. Graph
 * calls carry `appsecret_proof`, so a leaked user token is useless without
 * the app secret.
 */
function createFacebookProvider({
  clientId,
  clientSecret,
  redirectUri,
  mockUrl,
}) {
  const urls = mockUrl
    ? {
        auth: `${mockUrl}/facebook/dialog/oauth`,
        token: `${mockUrl}/facebook/oauth/access_token`,
        me: `${mockUrl}/facebook/me`,
      }
    : {
        auth: `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`,
        token: `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`,
        me: `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me`,
      }

  return {
    name: OAUTH_PROVIDER.FACEBOOK,
    usesPkce: false,

    authorizationUrl({ state }) {
      const url = new URL(urls.auth)

      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email,public_profile',
        state,
      })

      return url.href
    },

    async fetchProfile({ code }) {
      const tokenUrl = new URL(urls.token)

      tokenUrl.search = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      })

      const token = await requestJson(tokenUrl.href)
      const meUrl = new URL(urls.me)

      meUrl.search = new URLSearchParams({
        fields: 'id,name,email',
        access_token: token.access_token,
        appsecret_proof: createHmac('sha256', clientSecret)
          .update(token.access_token)
          .digest('hex'),
      })

      const me = await requestJson(meUrl.href)

      if (typeof me.id !== 'string' || me.id === '') {
        throw new OAuthProviderError('Facebook returned no account id')
      }

      return {
        providerUserId: me.id,
        email: typeof me.email === 'string' ? me.email.toLowerCase() : null,
        emailVerified: false,
        name: typeof me.name === 'string' ? me.name : '',
      }
    },
  }
}

/**
 * The configured providers, keyed by name. A provider without credentials is
 * left out, so the sign-in page never shows a button that cannot work.
 */
export function createOAuthProviders({ apiUrl, mockUrl, google, facebook }) {
  const redirectUriFor = (name) =>
    `${apiUrl}${API_PREFIX}/auth/oauth/${name}/callback`
  const providers = {}

  if (google) {
    providers.google = createGoogleProvider({
      ...google,
      redirectUri: redirectUriFor(OAUTH_PROVIDER.GOOGLE),
      mockUrl,
    })
  }

  if (facebook) {
    providers.facebook = createFacebookProvider({
      ...facebook,
      redirectUri: redirectUriFor(OAUTH_PROVIDER.FACEBOOK),
      mockUrl,
    })
  }

  return Object.freeze(providers)
}
