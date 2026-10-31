/**
 * Product pages: products gain descriptions, a gallery, categories and tags,
 * and two collections hold the categories and the reviews. Existing products
 * get empty values so every document has the same shape; their content is
 * filled in from the admin (or `npm run seed` on a development database).
 */
const PRODUCT_DEFAULTS = {
  shortDescription: '',
  description: '',
  gallery: [],
  categoryIds: [],
  tags: [],
}
const PRODUCT_CATEGORY_INDEX = 'published_1_categoryIds_1'

/** @param db {import('mongodb').Db} */
export async function up(db) {
  const products = db.collection('products')

  for (const [field, value] of Object.entries(PRODUCT_DEFAULTS)) {
    await products.updateMany(
      { [field]: { $exists: false } },
      { $set: { [field]: value } },
    )
  }

  await products.createIndex(
    { published: 1, categoryIds: 1 },
    { name: PRODUCT_CATEGORY_INDEX },
  )

  const categories = db.collection('product_categories')

  await categories.createIndex({ slug: 1 }, { unique: true })
  await categories.createIndex({ sortOrder: 1 })

  await db.collection('product_reviews').createIndex({
    productId: 1,
    createdAt: -1,
  })
}

/**
 * Removes the new fields and collections, including any categories and
 * reviews written since.
 *
 * @param db {import('mongodb').Db}
 */
export async function down(db) {
  const products = db.collection('products')
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (collection) => collection.name,
    ),
  )

  if (existing.has('products')) {
    const indexes = await products.indexes()

    if (indexes.some((index) => index.name === PRODUCT_CATEGORY_INDEX)) {
      await products.dropIndex(PRODUCT_CATEGORY_INDEX)
    }

    await products.updateMany(
      {},
      {
        $unset: Object.fromEntries(
          Object.keys(PRODUCT_DEFAULTS).map((field) => [field, '']),
        ),
      },
    )
  }

  for (const name of ['product_categories', 'product_reviews']) {
    if (existing.has(name)) await db.dropCollection(name)
  }
}
