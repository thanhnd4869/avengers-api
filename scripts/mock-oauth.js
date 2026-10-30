/**
 * A stand-in for Google and Facebook, for trying sign-in on a developer
 * machine before real apps exist. Development only: the API refuses to start
 * in production with OAUTH_MOCK_URL set.
 *
 *   npm run mock-oauth            (listens on http://localhost:8090)
 *   OAUTH_MOCK_URL=http://localhost:8090 in the API's .env
 *
 * The "consent" page lets you type the account the provider should report,
 * including whether Google verified the address and a Facebook account with
 * no address at all. Pass `mock_profile` (base64url JSON) on the auth URL to
 * skip the page in scripts.
 */
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

const PORT = Number(process.env.MOCK_OAUTH_PORT ?? 8090)
const codes = new Map()
const tokens = new Map()

function escape(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  )
}

function send(response, status, body, type = 'application/json') {
  response.writeHead(status, { 'Content-Type': type })
  response.end(type === 'application/json' ? JSON.stringify(body) : body)
}

function readBody(request) {
  return new Promise((resolve) => {
    let data = ''
    request.on('data', (chunk) => (data += chunk))
    request.on('end', () => resolve(new URLSearchParams(data)))
  })
}

function issueCode(profile, redirectUri, state) {
  const code = randomBytes(16).toString('hex')

  codes.set(code, profile)
  const url = new URL(redirectUri)
  url.searchParams.set('code', code)
  url.searchParams.set('state', state)

  return url.href
}

function consentPage(provider, query) {
  const google = provider === 'google'
  const fields = Object.entries(Object.fromEntries(query))
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escape(key)}" value="${escape(value)}">`,
    )
    .join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Mock ${google ? 'Google' : 'Facebook'}</title>
<style>body{font-family:system-ui;background:#f4f5f7;padding:2rem}form{max-width:26rem;margin:auto;background:#fff;padding:1.5rem;border-radius:8px}label{display:block;margin:.75rem 0 .25rem}input[type=text],input[type=email]{width:100%;padding:.5rem;box-sizing:border-box}.row{display:flex;gap:.5rem;margin-top:1.25rem}</style>
</head><body><form method="post" action="/${provider}/consent">
<h1>Mock ${google ? 'Google' : 'Facebook'} sign-in</h1>
<p>Development only. Choose the account this provider should report.</p>
${fields}
<label>Provider account id</label><input type="text" name="sub" value="${google ? 'g' : 'fb'}-${randomBytes(4).toString('hex')}" required>
<label>Name</label><input type="text" name="name" value="Mock ${google ? 'Google' : 'Facebook'} User">
<label>Email (leave empty for none)</label><input type="email" name="email" value="">
${google ? '<label><input type="checkbox" name="email_verified" checked> Google verified this email</label>' : ''}
<div class="row"><button type="submit" name="decision" value="allow" id="allow">Continue</button>
<button type="submit" name="decision" value="deny" id="deny">Cancel</button></div>
</form></body></html>`
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`)
  const [, provider, ...rest] = url.pathname.split('/')
  const route = rest.join('/')

  if (!['google', 'facebook'].includes(provider)) {
    return send(response, 404, { error: 'not_found' })
  }

  const isAuth =
    (provider === 'google' && route === 'auth') ||
    (provider === 'facebook' && route === 'dialog/oauth')

  if (isAuth && request.method === 'GET') {
    const preset = url.searchParams.get('mock_profile')

    if (preset) {
      const profile = JSON.parse(Buffer.from(preset, 'base64url').toString())

      if (profile.deny) {
        const back = new URL(url.searchParams.get('redirect_uri'))
        back.searchParams.set('error', 'access_denied')
        back.searchParams.set('state', url.searchParams.get('state'))
        response.writeHead(302, { Location: back.href })
        return response.end()
      }

      response.writeHead(302, {
        Location: issueCode(
          profile,
          url.searchParams.get('redirect_uri'),
          url.searchParams.get('state'),
        ),
      })
      return response.end()
    }

    return send(
      response,
      200,
      consentPage(provider, url.searchParams),
      'text/html; charset=utf-8',
    )
  }

  if (route === 'consent' && request.method === 'POST') {
    const form = await readBody(request)
    const redirectUri = form.get('redirect_uri')
    const state = form.get('state')

    if (form.get('decision') !== 'allow') {
      const back = new URL(redirectUri)
      back.searchParams.set('error', 'access_denied')
      back.searchParams.set('state', state)
      response.writeHead(302, { Location: back.href })
      return response.end()
    }

    response.writeHead(302, {
      Location: issueCode(
        {
          sub: form.get('sub'),
          name: form.get('name'),
          email: form.get('email') || null,
          email_verified: form.get('email_verified') === 'on',
        },
        redirectUri,
        state,
      ),
    })
    return response.end()
  }

  const exchange = (code) => {
    const profile = codes.get(code)

    if (!profile) return null
    codes.delete(code)
    const token = randomBytes(16).toString('hex')
    tokens.set(token, profile)

    return token
  }

  if (provider === 'google' && route === 'token' && request.method === 'POST') {
    const token = exchange((await readBody(request)).get('code'))

    return token
      ? send(response, 200, { access_token: token, token_type: 'Bearer' })
      : send(response, 400, { error: 'invalid_grant' })
  }

  if (provider === 'google' && route === 'userinfo') {
    const token = (request.headers.authorization ?? '').replace(/^Bearer /, '')
    const profile = tokens.get(token)

    if (!profile) return send(response, 401, { error: 'invalid_token' })

    return send(response, 200, {
      sub: profile.sub,
      name: profile.name,
      ...(profile.email
        ? { email: profile.email, email_verified: profile.email_verified }
        : {}),
    })
  }

  if (provider === 'facebook' && route === 'oauth/access_token') {
    const token = exchange(url.searchParams.get('code'))

    return token
      ? send(response, 200, { access_token: token, token_type: 'bearer' })
      : send(response, 400, { error: { message: 'Invalid code' } })
  }

  if (provider === 'facebook' && route === 'me') {
    const profile = tokens.get(url.searchParams.get('access_token'))

    if (!profile || !url.searchParams.get('appsecret_proof')) {
      return send(response, 400, { error: { message: 'Invalid token' } })
    }

    return send(response, 200, {
      id: profile.sub,
      name: profile.name,
      ...(profile.email ? { email: profile.email } : {}),
    })
  }

  return send(response, 404, { error: 'not_found' })
})

server.listen(PORT, 'localhost', () => {
  console.log(`Mock Google and Facebook at http://localhost:${PORT}`)
})
