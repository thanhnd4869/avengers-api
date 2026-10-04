import { USER_ROLE } from '@constants/auth.js'
import { User } from '@models/user.model.js'

const DUPLICATE_KEY = 11000

export function isDuplicateKeyError(error) {
  return error?.code === DUPLICATE_KEY
}

export function createUser({ email, displayName, passwordHash, role }) {
  return User.create({ email, displayName, passwordHash, role })
}

export function findUserById(userId) {
  return User.findById(userId)
}

export function findUserByEmail(email) {
  return User.findOne({ email: email.toLowerCase() })
}

export function findUserByEmailWithPassword(email) {
  return User.findOne({ email: email.toLowerCase() }).select('+passwordHash')
}

export function markEmailVerified(userId, at = new Date()) {
  return User.findOneAndUpdate(
    { _id: userId, emailVerifiedAt: null },
    { $set: { emailVerifiedAt: at } },
    { returnDocument: 'after' },
  )
}

export function updatePasswordHash(userId, passwordHash) {
  return User.updateOne({ _id: userId }, { $set: { passwordHash } })
}

/**
 * Creates or promotes an administrator. Used by `npm run create-admin`, never
 * by an HTTP route.
 */
export async function upsertAdmin({ email, displayName, passwordHash }) {
  const filter = { email: email.toLowerCase() }
  const admin = await User.findOneAndUpdate(
    filter,
    { $set: { displayName, passwordHash, role: USER_ROLE.ADMIN } },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )

  // Admins must be verified. An existing verification date is kept.
  return (await markEmailVerified(admin._id)) ?? admin
}
