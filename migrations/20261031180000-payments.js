/**
 * Payments: one record per attempt to pay an order, looked up by the
 * reference VNPay knows it by.
 */
/** @param db {import('mongodb').Db} */
export async function up(db) {
  const payments = db.collection('payments')

  await payments.createIndex({ txnRef: 1 }, { unique: true })
  await payments.createIndex({ orderId: 1, createdAt: -1 })
  await payments.createIndex({ status: 1, createdAt: -1 })
}

/**
 * Drops every payment record. Orders keep their `paid` status.
 *
 * @param db {import('mongodb').Db}
 */
export async function down(db) {
  const [existing] = await db
    .listCollections({ name: 'payments' }, { nameOnly: true })
    .toArray()

  if (existing) await db.dropCollection('payments')
}
