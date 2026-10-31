/**
 * Every Redis key the API writes, in one place, so the layout can be read at
 * a glance and no two features pick the same name. The prefix keeps several
 * environments apart on one Redis.
 */
export function createRedisKeys(prefix) {
  return Object.freeze({
    /** Hash: the user's one session. */
    session: (userId) => `${prefix}session:${userId}`,
    /** String: refresh token hash → userId, to find the session. */
    refreshToken: (tokenHash) => `${prefix}refresh:${tokenHash}`,
    /** String: the token replaced last → userId, to tell reuse from expiry. */
    previousRefreshToken: (tokenHash) => `${prefix}refresh-prev:${tokenHash}`,
    /** String (JSON): an emailed link's details, by token hash. */
    userToken: (tokenHash) => `${prefix}user-token:${tokenHash}`,
    /** String: the hash of the user's newest link of a kind. */
    latestUserToken: (userId, type) =>
      `${prefix}user-token-latest:${userId}:${type}`,
    /** String: present while the user must wait before another email. */
    emailCooldown: (userId, type) =>
      `${prefix}email-cooldown:${userId}:${type}`,
    /** Prefix for express-rate-limit counters. */
    rateLimit: (name) => `${prefix}rate-limit:${name}:`,
  })
}
