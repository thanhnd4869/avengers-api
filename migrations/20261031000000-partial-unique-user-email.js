/**
 * Lets several accounts have no email address (a Facebook sign-up that shared
 * none): the unique index on `users.email` only covers string values from
 * here on. A database already on the partial index is left as it is.
 */
const INDEX_NAME = 'email_1'
const PARTIAL_FILTER = { email: { $type: 'string' } }

async function currentIndex(users) {
  try {
    return (await users.indexes()).find((index) => index.name === INDEX_NAME)
  } catch (error) {
    // A fresh database has no `users` collection yet.
    if (error.codeName === 'NamespaceNotFound') return undefined
    throw error
  }
}

/** @param db {import('mongodb').Db} */
export async function up(db) {
  const users = db.collection('users')
  const index = await currentIndex(users)

  if (
    index?.unique &&
    JSON.stringify(index.partialFilterExpression) ===
      JSON.stringify(PARTIAL_FILTER)
  ) {
    return
  }

  if (index) await users.dropIndex(INDEX_NAME)

  await users.createIndex(
    { email: 1 },
    { name: INDEX_NAME, unique: true, partialFilterExpression: PARTIAL_FILTER },
  )
}

/**
 * Back to every account needing a distinct address. Fails, leaving the
 * partial index in place, while more than one account has no address.
 *
 * @param db {import('mongodb').Db}
 */
export async function down(db) {
  const users = db.collection('users')
  const withoutEmail = await users.countDocuments({ email: null })

  if (withoutEmail > 1) {
    throw new Error(
      `${withoutEmail} accounts have no email address; give them one first`,
    )
  }

  if (await currentIndex(users)) await users.dropIndex(INDEX_NAME)

  await users.createIndex({ email: 1 }, { name: INDEX_NAME, unique: true })
}
