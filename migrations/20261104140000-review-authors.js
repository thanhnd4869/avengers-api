/**
 * Reviews written on the site: each belongs to the shopper who wrote it, and
 * a shopper may review a game once. Existing (sample) reviews get no author
 * account, which the unique index leaves out.
 */
const UNIQUE_INDEX = 'one_review_per_user'

/** @param db {import('mongodb').Db} */
export async function up(db) {
  const reviews = db.collection('product_reviews')

  await reviews.updateMany(
    { userId: { $exists: false } },
    { $set: { userId: null } },
  )
  await reviews.createIndex(
    { productId: 1, userId: 1 },
    {
      name: UNIQUE_INDEX,
      unique: true,
      partialFilterExpression: { userId: { $type: 'objectId' } },
    },
  )
  await reviews.createIndex({ userId: 1 })
}

/**
 * Drops the indexes. Reviews written on the site stay, without the guarantee
 * of one per shopper.
 *
 * @param db {import('mongodb').Db}
 */
export async function down(db) {
  const reviews = db.collection('product_reviews')
  const names = (await reviews.indexes()).map((index) => index.name)

  for (const name of [UNIQUE_INDEX, 'userId_1']) {
    if (names.includes(name)) await reviews.dropIndex(name)
  }
}
