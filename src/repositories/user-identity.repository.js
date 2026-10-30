import { UserIdentity } from '@models/user-identity.model.js'

const DUPLICATE_KEY = 11000

export function isDuplicateKeyError(error) {
  return error?.code === DUPLICATE_KEY
}

export function findIdentity({ provider, providerUserId }) {
  return UserIdentity.findOne({ provider, providerUserId })
}

export function findUserIdentity({ userId, provider }) {
  return UserIdentity.findOne({ userId, provider })
}

export function listUserIdentities(userId) {
  return UserIdentity.find({ userId }).sort({ createdAt: 1 })
}

export function countUserIdentities(userId) {
  return UserIdentity.countDocuments({ userId })
}

export function createIdentity({ userId, provider, providerUserId, email }) {
  return UserIdentity.create({ userId, provider, providerUserId, email })
}

export function deleteIdentityById(identityId) {
  return UserIdentity.deleteOne({ _id: identityId })
}

export function deleteUserIdentity({ userId, provider }) {
  return UserIdentity.deleteOne({ userId, provider })
}

export function deleteUserIdentities(userId) {
  return UserIdentity.deleteMany({ userId })
}
