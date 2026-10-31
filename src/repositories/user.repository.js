import { USER_ROLE } from '#constants/auth.js'
import { User } from '#models/user.model.js'

const DUPLICATE_KEY = 11000

export function isDuplicateKeyError(error) {
  return error?.code === DUPLICATE_KEY
}

export function createUser({
  email,
  displayName,
  passwordHash,
  role,
  hasPassword = true,
  emailVerifiedAt = null,
}) {
  return User.create({
    email,
    displayName,
    passwordHash,
    role,
    hasPassword,
    emailVerifiedAt,
  })
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

export function findUserByIdWithPassword(userId) {
  return User.findById(userId).select('+passwordHash')
}

export function updatePasswordHash(userId, passwordHash) {
  return User.updateOne(
    { _id: userId },
    { $set: { passwordHash, hasPassword: true } },
  )
}

/**
 * Takes an unverified account over for whoever proved they own its address
 * through Google: the password chosen at sign-up, and any address change it
 * started, may belong to someone else and are dropped.
 */
export function detachPassword(userId, at = new Date()) {
  return User.findByIdAndUpdate(
    userId,
    {
      $set: {
        passwordHash: null,
        hasPassword: false,
        pendingEmail: null,
        emailVerifiedAt: at,
      },
    },
    { returnDocument: 'after' },
  )
}

export function updateDisplayName(userId, displayName) {
  return User.findByIdAndUpdate(
    userId,
    { $set: { displayName } },
    { returnDocument: 'after', runValidators: true },
  )
}

export function setPendingEmail(userId, pendingEmail) {
  return User.findByIdAndUpdate(
    userId,
    { $set: { pendingEmail } },
    { returnDocument: 'after' },
  )
}

/**
 * Switches to the address a change-email link confirmed. Matching on
 * `pendingEmail` means a cancelled or superseded request cannot be applied.
 * The unique email index rejects an address taken in the meantime.
 */
export function applyPendingEmail(userId, email, at = new Date()) {
  return User.findOneAndUpdate(
    { _id: userId, pendingEmail: email },
    { $set: { email, pendingEmail: null, emailVerifiedAt: at } },
    { returnDocument: 'after' },
  )
}

/**
 * Gives an account with no address yet the one Google verified. Matching on
 * `email: null` means it never overwrites an address the owner chose.
 */
export function setVerifiedEmail(userId, email, at = new Date()) {
  return User.findOneAndUpdate(
    { _id: userId, email: null },
    { $set: { email, emailVerifiedAt: at, pendingEmail: null } },
    { returnDocument: 'after' },
  )
}

export function deleteUserById(userId) {
  return User.deleteOne({ _id: userId })
}

/**
 * Creates or promotes an administrator. Used by `npm run create-admin`, never
 * by an HTTP route.
 */
export async function upsertAdmin({ email, displayName, passwordHash }) {
  const filter = { email: email.toLowerCase() }
  const admin = await User.findOneAndUpdate(
    filter,
    {
      $set: {
        displayName,
        passwordHash,
        hasPassword: true,
        role: USER_ROLE.ADMIN,
      },
    },
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
