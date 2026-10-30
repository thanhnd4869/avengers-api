import mongoose from 'mongoose'
import { USER_ROLE } from '@constants/auth.js'
import { publicJsonPlugin } from './plugins/public-json.plugin.js'

const userSchema = new mongoose.Schema(
  {
    // Stored lowercased so the unique index treats `A@x.com` and `a@x.com` as
    // the same account.
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 32 },
    // Never selected unless a query asks for it with `+passwordHash`, so no
    // ordinary read can leak it into a response.
    passwordHash: { type: String, required: true, select: false },
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

userSchema.plugin(publicJsonPlugin, { hidden: ['passwordHash'] })

export const User = mongoose.model('User', userSchema)
