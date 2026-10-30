import mongoose from 'mongoose'

/**
 * One signed-in device. Access tokens carry the session id, so deleting the
 * document signs that device out on its very next request.
 */
const sessionSchema = new mongoose.Schema(
  {
    // Unique: an account holds a single live session, and the database itself
    // rejects a second one instead of trusting every code path to clean up.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    // SHA-256 of the refresh token; the raw value only ever lives in the
    // visitor's cookie, so a database leak hands out no usable token.
    refreshTokenHash: { type: String, required: true, unique: true },
    // Kept to tell a reused (stolen) token apart from one that simply expired.
    previousRefreshTokenHash: { type: String, default: null, index: true },
    // When the token last changed. Two tabs refreshing at once both present
    // the same token; the slower one arrives just after rotation and must not
    // be mistaken for theft.
    rotatedAt: { type: Date, default: null },
    // Whether the cookie outlives the browser session.
    persistent: { type: Boolean, default: false },
    // When the visitor last proved who they are (sign-in, or confirming with
    // Google or Facebook). An account without a password must have done so
    // recently before changing its email or deleting itself.
    authenticatedAt: { type: Date, default: null },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'sessions' },
)

// MongoDB removes expired sessions on its own, roughly once a minute.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const Session = mongoose.model('Session', sessionSchema)
