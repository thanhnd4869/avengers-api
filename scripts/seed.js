/**
 * Empties the configured database and refills it from `seed-data.json`.
 *
 * Run with `npm run seed`. It refuses to run when NODE_ENV is `production`,
 * because every collection in the database is dropped first.
 */
import { readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '@config/database.js'
import { getEnvironment, loadEnvironmentFile } from '@config/environment.js'
import { createLogger } from '@config/logger.js'
import { Banner } from '@models/banner.model.js'
import { ContactMessage } from '@models/contact-message.model.js'
import { Media } from '@models/media.model.js'
import { Platform } from '@models/platform.model.js'
import { Post } from '@models/post.model.js'
import { PostCategory } from '@models/post-category.model.js'
import { Product } from '@models/product.model.js'
import { ProductVariant } from '@models/product-variant.model.js'
import { SocialLink } from '@models/social-link.model.js'

const MODELS = [
  Platform,
  Product,
  ProductVariant,
  PostCategory,
  Post,
  Banner,
  Media,
  SocialLink,
  ContactMessage,
]

function idsBySlug(documents) {
  return new Map(documents.map((document) => [document.slug, document._id]))
}

function lookup(map, slug, kind) {
  const id = map.get(slug)

  if (!id) {
    throw new Error(`Seed data refers to unknown ${kind} "${slug}"`)
  }

  return id
}

async function seed(data) {
  const platforms = await Platform.insertMany(data.platforms)
  const platformIds = idsBySlug(platforms)

  const products = await Product.insertMany(
    data.products.map(({ variants: _variants, ...product }) => product),
  )
  const productIds = idsBySlug(products)

  await ProductVariant.insertMany(
    data.products.flatMap((product) =>
      product.variants.map(({ platform, ...variant }) => ({
        ...variant,
        productId: lookup(productIds, product.slug, 'product'),
        platformId: lookup(platformIds, platform, 'platform'),
      })),
    ),
  )

  const categories = await PostCategory.insertMany(data.postCategories)
  const categoryIds = idsBySlug(categories)

  await Post.insertMany(
    data.posts.map(({ category, ...post }) => ({
      ...post,
      categoryId: lookup(categoryIds, category, 'post category'),
    })),
  )

  await Banner.insertMany(data.banners)
  await Media.insertMany(data.media)
  await SocialLink.insertMany(data.socialLinks)
}

loadEnvironmentFile()

const environment = getEnvironment()
const logger = createLogger(environment)

if (environment.isProduction) {
  logger.error('Refusing to seed: NODE_ENV is production')
  process.exit(1)
}

const data = JSON.parse(
  await readFile(new URL('./seed-data.json', import.meta.url), 'utf8'),
)

await connectDatabase({
  mongodbUri: environment.mongodbUri,
  mongodbDbName: environment.mongodbDbName,
  logger,
})

try {
  // Atlas users usually lack `dropDatabase`, so every collection is dropped on
  // its own. This also removes collections no model maps to any more.
  const existing = await mongoose.connection.db
    .listCollections({}, { nameOnly: true })
    .toArray()

  for (const { name } of existing) {
    if (!name.startsWith('system.')) {
      await mongoose.connection.db.dropCollection(name)
      logger.info(`Dropped collection "${name}"`)
    }
  }

  // Collections and indexes are created up front, so unique constraints are
  // already enforced while the seed data is inserted.
  for (const model of MODELS) {
    await model.createCollection()
    await model.syncIndexes()
  }

  await seed(data)

  for (const model of MODELS) {
    logger.info(
      `${model.collection.name}: ${await model.countDocuments()} documents`,
    )
  }
} finally {
  await disconnectDatabase()
}
