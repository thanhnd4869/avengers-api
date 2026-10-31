import { UserToken } from '#models/user-token.model.js'

export function findLatestUserToken({ userId, type }) {
  return UserToken.findOne({ userId, type }).sort({ createdAt: -1 })
}

/**
 * Issues a new token and drops any older unused one of the same kind, so only
 * the most recent email link works.
 */
export async function replaceUserToken({
  userId,
  type,
  tokenHash,
  expiresAt,
  email = null,
}) {
  await UserToken.deleteMany({ userId, type, usedAt: null })

  return UserToken.create({ userId, type, tokenHash, expiresAt, email })
}

/**
 * Marks a token used and returns it, atomically, so a link clicked twice at
 * once is honoured only once. `null` means unknown, expired or already used.
 */
export function consumeUserToken({ type, tokenHash }) {
  return UserToken.findOneAndUpdate(
    { type, tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { returnDocument: 'after' },
  )
}

export function deleteUserTokens({ userId, type }) {
  return UserToken.deleteMany({ userId, type })
}

export function deleteAllUserTokens(userId) {
  return UserToken.deleteMany({ userId })
}
