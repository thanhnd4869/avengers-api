import { randomUUID } from 'node:crypto'

/**
 * The one live session of each user, in Redis:
 *
 *   session:<userId>          hash   id, refreshTokenHash, persistent, role,
 *                                    emailVerified, authenticatedAt, ...
 *   refresh:<tokenHash>       string userId, to find the session from a cookie
 *   refresh-prev:<tokenHash>  string userId, the token replaced last
 *
 * All three expire with the session, so Redis forgets a session on its own.
 * Writes that touch more than one key run as Lua scripts, which Redis
 * executes atomically: a session is never half replaced or half rotated.
 */

// KEYS: session, refresh:<new hash>
// ARGV: refresh prefix, refresh-prev prefix, userId, expiry (ms), fields...
const REPLACE_SESSION = `
local old = redis.call('HGET', KEYS[1], 'refreshTokenHash')
local oldPrev = redis.call('HGET', KEYS[1], 'previousRefreshTokenHash')
if old then redis.call('DEL', ARGV[1] .. old) end
if oldPrev then redis.call('DEL', ARGV[2] .. oldPrev) end
redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1], unpack(ARGV, 5))
redis.call('PEXPIREAT', KEYS[1], ARGV[4])
redis.call('SET', KEYS[2], ARGV[3], 'PXAT', ARGV[4])
return 1
`

// Swaps the refresh token only if the one presented is still current, so two
// concurrent refreshes cannot both succeed with the same token.
// KEYS: session, refresh:<current>, refresh:<next>, refresh-prev:<current>
// ARGV: current hash, next hash, now, expiry, userId, refresh-prev prefix
const ROTATE_REFRESH_TOKEN = `
if redis.call('HGET', KEYS[1], 'refreshTokenHash') ~= ARGV[1] then return 0 end
local oldPrev = redis.call('HGET', KEYS[1], 'previousRefreshTokenHash')
if oldPrev then redis.call('DEL', ARGV[6] .. oldPrev) end
redis.call('DEL', KEYS[2])
redis.call('HSET', KEYS[1], 'refreshTokenHash', ARGV[2],
  'previousRefreshTokenHash', ARGV[1], 'rotatedAt', ARGV[3])
redis.call('PEXPIREAT', KEYS[1], ARGV[4])
redis.call('SET', KEYS[3], ARGV[5], 'PXAT', ARGV[4])
redis.call('SET', KEYS[4], ARGV[5], 'PXAT', ARGV[4])
return 1
`

const DELETE_SESSION = `
local current = redis.call('HGET', KEYS[1], 'refreshTokenHash')
local prev = redis.call('HGET', KEYS[1], 'previousRefreshTokenHash')
if current then redis.call('DEL', ARGV[1] .. current) end
if prev then redis.call('DEL', ARGV[2] .. prev) end
return redis.call('DEL', KEYS[1])
`

// Changes fields only on a session that still exists, keeping its expiry.
const UPDATE_SESSION = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1], unpack(ARGV))
return 1
`

const toFields = (record) =>
  Object.entries(record).flatMap(([key, value]) => [
    key,
    value === null || value === undefined ? '' : String(value),
  ])

function parseSession(hash) {
  if (!hash || !hash.id) return null

  return {
    id: hash.id,
    userId: hash.userId,
    refreshTokenHash: hash.refreshTokenHash,
    previousRefreshTokenHash: hash.previousRefreshTokenHash || null,
    persistent: hash.persistent === 'true',
    role: hash.role,
    emailVerified: hash.emailVerified === 'true',
    userAgent: hash.userAgent ?? '',
    ip: hash.ip ?? '',
    createdAt: new Date(Number(hash.createdAt)),
    expiresAt: new Date(Number(hash.expiresAt)),
    authenticatedAt: hash.authenticatedAt
      ? new Date(Number(hash.authenticatedAt))
      : null,
    rotatedAt: hash.rotatedAt ? new Date(Number(hash.rotatedAt)) : null,
  }
}

export function createSessionRepository({ redis, keys }) {
  const refreshPrefix = keys.refreshToken('')
  const previousPrefix = keys.previousRefreshToken('')

  async function findSessionByUserId(userId) {
    const session = parseSession(await redis.hGetAll(keys.session(userId)))

    // Redis drops the key at `expiresAt`; the check covers the moments before.
    return session && session.expiresAt.getTime() > Date.now() ? session : null
  }

  return {
    /**
     * Starts the only session of a user, replacing any other in one step.
     * The new session gets a fresh id, so access tokens of the previous
     * device stop working.
     */
    async replaceUserSession({
      userId,
      refreshTokenHash,
      persistent,
      role,
      emailVerified,
      userAgent,
      ip,
      expiresAt,
    }) {
      const now = Date.now()
      const session = {
        id: randomUUID(),
        userId: String(userId),
        refreshTokenHash,
        persistent,
        role,
        emailVerified,
        userAgent,
        ip,
        createdAt: now,
        expiresAt: expiresAt.getTime(),
        authenticatedAt: now,
      }

      await redis.eval(REPLACE_SESSION, {
        keys: [keys.session(userId), keys.refreshToken(refreshTokenHash)],
        arguments: [
          refreshPrefix,
          previousPrefix,
          String(userId),
          String(expiresAt.getTime()),
          ...toFields(session),
        ],
      })

      return parseSession(
        Object.fromEntries(
          Object.entries(session).map(([key, value]) => [key, String(value)]),
        ),
      )
    },

    findSessionByUserId,

    async findSessionByRefreshTokenHash(tokenHash) {
      const userId = await redis.get(keys.refreshToken(tokenHash))

      return userId ? findSessionByUserId(userId) : null
    },

    async findSessionByPreviousRefreshTokenHash(tokenHash) {
      const userId = await redis.get(keys.previousRefreshToken(tokenHash))

      if (!userId) return null

      const session = await findSessionByUserId(userId)

      return session?.previousRefreshTokenHash === tokenHash ? session : null
    },

    /** `true` when this request's token was still current and got replaced. */
    async rotateRefreshToken({ userId, currentHash, nextHash, expiresAt }) {
      const rotated = await redis.eval(ROTATE_REFRESH_TOKEN, {
        keys: [
          keys.session(userId),
          keys.refreshToken(currentHash),
          keys.refreshToken(nextHash),
          keys.previousRefreshToken(currentHash),
        ],
        arguments: [
          currentHash,
          nextHash,
          String(Date.now()),
          String(expiresAt.getTime()),
          String(userId),
          previousPrefix,
        ],
      })

      return rotated === 1
    },

    /** Records a fresh proof of identity, such as confirming with Google. */
    markSessionAuthenticated(userId, at = new Date()) {
      return redis.eval(UPDATE_SESSION, {
        keys: [keys.session(userId)],
        arguments: ['authenticatedAt', String(at.getTime())],
      })
    },

    /**
     * Keeps the claims checked on every request in step with the user, so a
     * role change or a verified address applies without signing in again.
     */
    updateSessionClaims(userId, { role, emailVerified }) {
      const fields = []

      if (role !== undefined) fields.push('role', String(role))
      if (emailVerified !== undefined) {
        fields.push('emailVerified', String(emailVerified))
      }

      return fields.length
        ? redis.eval(UPDATE_SESSION, {
            keys: [keys.session(userId)],
            arguments: fields,
          })
        : 0
    },

    deleteUserSession(userId) {
      return redis.eval(DELETE_SESSION, {
        keys: [keys.session(userId)],
        arguments: [refreshPrefix, previousPrefix],
      })
    },
  }
}
