/**
 * Empties the configured database and refills it from `seed-data.json`, then
 * records every existing migration as applied.
 *
 * Run with `npm run seed`. It refuses to run when NODE_ENV is `production`,
 * because every collection in the database is dropped first.
 */
import { readdir, readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '#config/database.js'
import { getEnvironment, loadEnvironmentFile } from '#config/environment.js'
import { createLogger } from '#config/logger.js'
import {
  MIGRATIONS_CHANGELOG_COLLECTION,
  MIGRATIONS_DIR,
} from '#config/migrations.js'
import { Banner } from '#models/banner.model.js'
import { Cart } from '#models/cart.model.js'
import { ContactMessage } from '#models/contact-message.model.js'
import { Media } from '#models/media.model.js'
import { Platform } from '#models/platform.model.js'
import { Post } from '#models/post.model.js'
import { PostCategory } from '#models/post-category.model.js'
import { Product } from '#models/product.model.js'
import { ProductCategory } from '#models/product-category.model.js'
import { ProductReview } from '#models/product-review.model.js'
import { ProductVariant } from '#models/product-variant.model.js'
import { SocialLink } from '#models/social-link.model.js'
import { UserIdentity } from '#models/user-identity.model.js'
import { User } from '#models/user.model.js'

// Every model, including the account ones that get no seed data, so each
// collection is recreated with its indexes (unique email, provider ids)
// before the API accepts its first sign-up. Sessions and emailed links live
// in Redis, which seeding leaves alone.
const MODELS = [
  Platform,
  ProductCategory,
  Product,
  ProductVariant,
  ProductReview,
  PostCategory,
  Post,
  Banner,
  Media,
  SocialLink,
  ContactMessage,
  User,
  UserIdentity,
  Cart,
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

  const productCategories = await ProductCategory.insertMany(
    data.productCategories,
  )
  const productCategoryIds = idsBySlug(productCategories)

  const products = await Product.insertMany(
    data.products.map(
      ({ variants: _variants, reviews: _reviews, categories, ...product }) => ({
        ...product,
        categoryIds: categories.map((slug) =>
          lookup(productCategoryIds, slug, 'product category'),
        ),
      }),
    ),
  )
  const productIds = idsBySlug(products)

  await ProductReview.insertMany(
    data.products.flatMap((product) =>
      product.reviews.map((review) => ({
        ...review,
        productId: lookup(productIds, product.slug, 'product'),
      })),
    ),
  )

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

  // The models and the seed data already describe the latest schema, so
  // every migration written so far counts as applied; `npm run migrate -- up`
  // then only runs the ones added later.
  const migrations = (await readdir(MIGRATIONS_DIR))
    .filter((fileName) => fileName.endsWith('.js'))
    .sort()

  if (migrations.length > 0) {
    const appliedAt = new Date()

    await mongoose.connection.db
      .collection(MIGRATIONS_CHANGELOG_COLLECTION)
      .insertMany(
        migrations.map((fileName) => ({
          fileName,
          appliedAt,
          migrationBlock: appliedAt.getTime(),
        })),
      )
  }

  logger.info(`Marked ${migrations.length} migrations as applied`)

  for (const model of MODELS) {
    logger.info(
      `${model.collection.name}: ${await model.countDocuments()} documents`,
    )
  }
} finally {
  await disconnectDatabase()
}
