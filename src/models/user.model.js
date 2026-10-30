import mongoose from 'mongoose'
import { USER_ROLE } from '@constants/auth.js'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

const userSchema = new mongoose.Schema(
  {
    // Stored lowercased so the unique index treats `A@x.com` and `a@x.com` as
    // the same account. `null` for a Facebook sign-up that shared no address;
    // the index below only covers real addresses, so many such accounts can
    // exist. `npm run migrate:email-index` moves an older database onto it.
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 32 },
    // Never selected unless a query asks for it with `+passwordHash`, so no
    // ordinary read can leak it into a response. `null` for an account that
    // signs in with Google or Facebook only.
    passwordHash: { type: String, default: null, select: false },
    // Whether a password is set, readable without selecting the hash, so the
    // account page knows to offer "change" or "set" a password.
    hasPassword: { type: Boolean, default: true },
    role: {
      type: String,
      enum: Object.values(USER_ROLE),
      default: USER_ROLE.USER,
    },
    emailVerifiedAt: { type: Date, default: null },
    // A requested new address, waiting for the link mailed to it. The account
    // keeps signing in with `email` until then.
    pendingEmail: { type: String, default: null, lowercase: true, trim: true },
  },
  { timestamps: true, collection: 'users' },
)

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
)

userSchema.plugin(publicJsonPlugin, { hidden: ['passwordHash'] })

export const User = mongoose.model('User', userSchema)
