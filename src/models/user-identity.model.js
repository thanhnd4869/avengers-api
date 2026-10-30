import mongoose from 'mongoose'
import { OAUTH_PROVIDER } from '@constants/auth.js'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

/**
 * A Google or Facebook account linked to a user. The provider's own id is
 * what signs the visitor in; the email it reported is kept for display only,
 * since it may change on the provider's side.
 */
const userIdentitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(OAUTH_PROVIDER),
      required: true,
    },
    providerUserId: { type: String, required: true },
    email: { type: String, default: null },
  },
  { timestamps: true, collection: 'user_identities' },
)

// A provider account belongs to one user, and a user links at most one
// account per provider.
userIdentitySchema.index({ provider: 1, providerUserId: 1 }, { unique: true })
userIdentitySchema.index({ userId: 1, provider: 1 }, { unique: true })

userIdentitySchema.plugin(publicJsonPlugin, { hidden: ['providerUserId'] })

export const UserIdentity = mongoose.model('UserIdentity', userIdentitySchema)
