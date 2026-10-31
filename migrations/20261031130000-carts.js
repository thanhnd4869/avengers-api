/**
 * One cart per signed-in account. The unique index is what stops two first
 * writes from creating two carts for the same shopper.
 */
const INDEX_NAME = 'userId_1'

/** @param db {import('mongodb').Db} */
export async function up(db) {
  await db
    .collection('carts')
    .createIndex({ userId: 1 }, { name: INDEX_NAME, unique: true })
}

/**
 * Drops the carts with everything in them.
 *
 * @param db {import('mongodb').Db}
 */
export async function down(db) {
  const [existing] = await db
    .listCollections({ name: 'carts' }, { nameOnly: true })
    .toArray()

  if (existing) await db.dropCollection('carts')
}
