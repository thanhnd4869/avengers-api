import mongoose from 'mongoose'

// The short timeout keeps an unreachable cluster from holding the readiness
// endpoint open.
export async function pingDatabase() {
  await mongoose.connection.db.admin().ping({ maxTimeMS: 2000 })
}
