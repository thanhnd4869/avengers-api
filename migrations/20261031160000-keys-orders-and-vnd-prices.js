/**
 * Checkout: game keys become real records and the shop sells in VND, the only
 * currency VNPay accepts.
 *
 * - `product_keys` and `orders` get their indexes, including the one that
 *   allows a shopper only one unpaid order;
 * - each variant's `stock` number becomes `availableKeys`. Development
 *   databases get that many fake keys (capped at 30), so the counter matches
 *   the keys; production starts at zero and is stocked with real keys;
 * - USD prices become VND at a fixed 25,000 to the dollar, rounded to the
 *   thousand, one thousand below (649,000 rather than 650,000).
 *
 * Carts hold only variant ids, so they carry over; their totals follow the
 * new prices on the next read.
 */
import { loadEnvironmentFile, getEnvironment } from '#config/environment.js'
import { createKeyCipher } from '#utils/key-cipher.js'
import { generateFakeKeys } from '../scripts/fake-keys.js'

const USD_TO_VND = 25000
const FAKE_KEYS_CAP = 30

const toVnd = (usd) =>
  usd == null ? null : Math.round((usd * USD_TO_VND) / 1000) * 1000 - 1000

async function createIndexes(db) {
  const keys = db.collection('product_keys')

  await keys.createIndex({ codeHash: 1 }, { unique: true })
  await keys.createIndex({ variantId: 1, status: 1, _id: 1 })
  await keys.createIndex({ orderId: 1 })

  const orders = db.collection('orders')

  await orders.createIndex({ number: 1 }, { unique: true })
  await orders.createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true })
  await orders.createIndex(
    { userId: 1 },
    {
      name: 'one_pending_order_per_user',
      unique: true,
      partialFilterExpression: { status: 'pending' },
    },
  )
  await orders.createIndex({ userId: 1, createdAt: -1 })
  await orders.createIndex({ status: 1, expiresAt: 1 })
  await orders.createIndex({ keysReleasedAt: 1, keysReleaseAfter: 1 })
}

/** @param db {import('mongodb').Db} */
export async function up(db) {
  loadEnvironmentFile()

  const environment = getEnvironment()
  const keyCipher = createKeyCipher(environment.keyEncryptionKey)
  const variants = db.collection('product_variants')

  await createIndexes(db)

  // Variants already converted (no `stock` left) are skipped, so a rerun
  // after a failure picks up where it stopped.
  for (const variant of await variants
    .find({ stock: { $exists: true } })
    .toArray()) {
    const count = environment.isProduction
      ? 0
      : Math.min(Math.max(variant.stock, 0), FAKE_KEYS_CAP)

    if (count > 0) {
      await db.collection('product_keys').insertMany(
        generateFakeKeys(count, keyCipher).map((key) => ({
          ...key,
          variantId: variant._id,
          status: 'available',
          orderId: null,
          reservedAt: null,
          soldAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      )
    }

    const update = {
      $set: { availableKeys: count },
      $unset: { stock: '' },
    }

    if (variant.currency !== 'VND') {
      update.$set.price = toVnd(variant.price)
      update.$set.originalPrice = toVnd(variant.originalPrice)
      update.$set.currency = 'VND'
    }

    await variants.updateOne({ _id: variant._id }, update)
  }
}

/**
 * Back to a `stock` number and USD prices. Keys and orders are dropped, so
 * this loses every order placed since.
 *
 * @param db {import('mongodb').Db}
 */
export async function down(db) {
  const variants = db.collection('product_variants')

  for (const variant of await variants
    .find({ availableKeys: { $exists: true } })
    .toArray()) {
    const toUsd = (vnd) =>
      vnd == null ? null : Math.round((vnd + 1000) / USD_TO_VND)

    await variants.updateOne(
      { _id: variant._id },
      {
        $set: {
          stock: variant.availableKeys,
          price: toUsd(variant.price),
          originalPrice: toUsd(variant.originalPrice),
          currency: 'USD',
        },
        $unset: { availableKeys: '' },
      },
    )
  }

  for (const name of ['product_keys', 'orders']) {
    const [existing] = await db
      .listCollections({ name }, { nameOnly: true })
      .toArray()

    if (existing) await db.dropCollection(name)
  }
}
