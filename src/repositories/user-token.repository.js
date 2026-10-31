/**
 * Single-use tokens mailed to a user (verify email, reset password, change
 * email), in Redis. Only a hash of the token is stored, so the links in the
 * inbox are the only usable copies.
 *
 *   user-token:<hash>                 JSON { userId, type, email }, expires
 *                                     with the link
 *   user-token-latest:<userId>:<type> the hash of the user's newest link of
 *                                     that kind, so a new one replaces it
 *   email-cooldown:<userId>:<type>    present while the user must wait
 *                                     before another email of that kind
 */

// KEYS: user-token:<new>, latest  ARGV: user-token prefix, payload, expiry
const REPLACE_TOKEN = `
local previous = redis.call('GET', KEYS[2])
if previous then redis.call('DEL', ARGV[1] .. previous) end
redis.call('SET', KEYS[1], ARGV[2], 'PXAT', ARGV[3])
redis.call('SET', KEYS[2], ARGV[4], 'PXAT', ARGV[3])
return 1
`

export function createUserTokenRepository({ redis, keys }) {
  const tokenPrefix = keys.userToken('')

  return {
    /**
     * Issues a new link and makes any older unused one of the same kind
     * stop working, so only the most recent email can be followed.
     */
    async replaceUserToken({
      userId,
      type,
      tokenHash,
      expiresAt,
      email = null,
    }) {
      await redis.eval(REPLACE_TOKEN, {
        keys: [keys.userToken(tokenHash), keys.latestUserToken(userId, type)],
        arguments: [
          tokenPrefix,
          JSON.stringify({ userId: String(userId), type, email }),
          String(expiresAt.getTime()),
          tokenHash,
        ],
      })
    },

    /**
     * Reads and deletes a link in one atomic step, so a link clicked twice at
     * once is honoured only once. `null` means unknown, expired, already used
     * or of another kind.
     */
    async consumeUserToken({ type, tokenHash }) {
      const raw = await redis.getDel(keys.userToken(tokenHash))

      if (!raw) return null

      const token = JSON.parse(raw)

      return token.type === type ? token : null
    },

    async deleteUserTokens({ userId, type }) {
      const latestKey = keys.latestUserToken(userId, type)
      const latest = await redis.getDel(latestKey)

      if (latest) await redis.del(keys.userToken(latest))
    },

    async deleteAllUserTokens(userId, types) {
      await Promise.all(
        types.map((type) => this.deleteUserTokens({ userId, type })),
      )
    },

    /**
     * Starts the wait before another email of this kind. Resolves to the
     * seconds still to wait when one is already running, or 0 when it started.
     */
    async startEmailCooldown({ userId, type, seconds }) {
      const key = keys.emailCooldown(userId, type)
      const started = await redis.set(key, '1', {
        condition: 'NX',
        expiration: { type: 'EX', value: seconds },
      })

      if (started) return 0

      return Math.max(1, await redis.ttl(key))
    },

    clearEmailCooldowns(userId, types) {
      return redis.del(types.map((type) => keys.emailCooldown(userId, type)))
    },
  }
}
