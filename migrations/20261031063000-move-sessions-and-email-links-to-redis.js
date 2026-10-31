/**
 * Sessions and emailed links (verify email, reset password, change email)
 * now live in Redis, so their MongoDB collections are dropped. Everyone signs
 * in again once and older links stop working, as they would on any session
 * store migration. A database that never had them is left as it is.
 */
const COLLECTIONS = ['sessions', 'user_tokens']

/** @param db {import('mongodb').Db} */
export async function up(db) {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (collection) => collection.name,
    ),
  )

  for (const name of COLLECTIONS) {
    if (existing.has(name)) await db.dropCollection(name)
  }
}

/**
 * The old data is not brought back: sessions and links are short-lived, and
 * the previous version recreates both collections on start.
 */
export async function down() {}
