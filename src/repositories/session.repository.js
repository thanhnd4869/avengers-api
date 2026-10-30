import { Session } from '@models/session.model.js'

/**
 * Starts the only session of a user. Replacing in place (rather than delete
 * then insert) keeps the unique `userId` index from ever seeing two rows, and
 * gives the session a fresh id so tokens of the previous device stop working.
 */
export async function replaceUserSession({
  userId,
  refreshTokenHash,
  persistent,
  userAgent,
  ip,
  expiresAt,
}) {
  await Session.deleteOne({ userId })

  return Session.create({
    userId,
    refreshTokenHash,
    persistent,
    userAgent,
    ip,
    expiresAt,
    authenticatedAt: new Date(),
  })
}

/** Records a fresh proof of identity, such as confirming with Google. */
export function markSessionAuthenticated(sessionId, at = new Date()) {
  return Session.updateOne(
    { _id: sessionId },
    { $set: { authenticatedAt: at } },
  )
}

export function findActiveSessionById(sessionId) {
  return Session.findOne({ _id: sessionId, expiresAt: { $gt: new Date() } })
}

export function findActiveSessionByUserId(userId) {
  return Session.findOne({ userId, expiresAt: { $gt: new Date() } })
}

export function findSessionByRefreshTokenHash(refreshTokenHash) {
  return Session.findOne({ refreshTokenHash })
}

export function findSessionByPreviousRefreshTokenHash(refreshTokenHash) {
  return Session.findOne({ previousRefreshTokenHash: refreshTokenHash })
}

/**
 * Swaps the refresh token only if it is still the one presented, so two
 * concurrent refreshes cannot both succeed with the same token.
 */
export function rotateRefreshToken({
  sessionId,
  currentHash,
  nextHash,
  expiresAt,
}) {
  return Session.findOneAndUpdate(
    { _id: sessionId, refreshTokenHash: currentHash },
    {
      $set: {
        refreshTokenHash: nextHash,
        previousRefreshTokenHash: currentHash,
        rotatedAt: new Date(),
        expiresAt,
      },
    },
    { returnDocument: 'after' },
  )
}

export function deleteSessionById(sessionId) {
  return Session.deleteOne({ _id: sessionId })
}

export function deleteSessionsByUserId(userId) {
  return Session.deleteMany({ userId })
}
