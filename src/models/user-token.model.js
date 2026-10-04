import mongoose from 'mongoose'
import { USER_TOKEN_TYPE } from '@constants/auth.js'

/**
 * Single-use tokens mailed to a user to confirm an action. Only a hash is
 * stored, so the links in the inbox are the only usable copies.
 */
const userTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(USER_TOKEN_TYPE),
      required: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'user_tokens' },
)

// Lets a new email replace the previous token and enforces the resend cooldown.
userTokenSchema.index({ userId: 1, type: 1, createdAt: -1 })
userTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const UserToken = mongoose.model('UserToken', userTokenSchema)
