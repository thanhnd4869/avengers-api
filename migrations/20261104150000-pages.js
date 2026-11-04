/**
 * Site pages kept in the database: the FAQ and the refund, terms and privacy
 * policies, with their first content. A page that already exists is left as
 * it is, so content edited since is never overwritten.
 */
import { readFile } from 'node:fs/promises'

async function readPages() {
  return JSON.parse(
    await readFile(
      new URL('../scripts/pages-data.json', import.meta.url),
      'utf8',
    ),
  )
}

/** @param db {import('mongodb').Db} */
export async function up(db) {
  const pages = db.collection('pages')

  await pages.createIndex({ slug: 1 }, { unique: true })

  const now = new Date()

  for (const page of await readPages()) {
    await pages.updateOne(
      { slug: page.slug },
      {
        $setOnInsert: {
          ...page,
          published: true,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    )
  }
}

/**
 * Drops every page, including any edits made since.
 *
 * @param db {import('mongodb').Db}
 */
export async function down(db) {
  const [existing] = await db
    .listCollections({ name: 'pages' }, { nameOnly: true })
    .toArray()

  if (existing) await db.dropCollection('pages')
}
