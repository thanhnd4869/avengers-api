import mongoose from 'mongoose'
import { KEY_STATUS, ORDER_STATUS, PAYMENT_STATUS } from '#constants/order.js'
import { Order } from '#models/order.model.js'
import { Payment } from '#models/payment.model.js'
import { ProductKey } from '#models/product-key.model.js'
import { ProductVariant } from '#models/product-variant.model.js'

const DUPLICATE_KEY = 11000

/**
 * Thrown inside a transaction to abort it with a reason the service turns
 * into a response. Anything else thrown aborts it as an unexpected failure.
 */
export class OrderConflict extends Error {
  constructor(reason, details = {}) {
    super(reason)
    this.reason = reason
    this.details = details
  }
}

export function isDuplicateKeyError(error, indexName) {
  return (
    error?.code === DUPLICATE_KEY &&
    (!indexName || String(error.message).includes(indexName))
  )
}

/**
 * Runs `work` in a transaction. Conflicts between transactions (two checkouts
 * touching the same variant at once) make the driver retry the whole of
 * `work`, so it must not have side effects outside the database.
 */
function inTransaction(work) {
  return mongoose.connection.transaction((session) => work(session), {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  })
}

/**
 * Holds `quantity` keys of each line for a new order and creates it, all or
 * nothing.
 *
 * Each variant's `availableKeys` is decremented only while it is at least the
 * quantity asked for, in the same statement that reads it. Of two checkouts
 * racing for the last key, the second finds the counter too low and fails
 * with `OrderConflict('OUT_OF_STOCK')`; and since the decrement is a write,
 * MongoDB also makes one of two overlapping transactions retry rather than
 * both commit. Only then are that many available keys flipped to `reserved`,
 * which by construction exist.
 *
 * The partial unique index on pending orders turns a second pending order for
 * the same shopper into a duplicate key error, and the idempotency index does
 * the same for a repeated request; the caller handles both.
 */
export function createOrderWithReservation(order) {
  return inTransaction(async (session) => {
    const [created] = await Order.create([order], { session })
    const now = new Date()

    for (const item of order.items) {
      const counter = await ProductVariant.updateOne(
        { _id: item.variantId, availableKeys: { $gte: item.quantity } },
        { $inc: { availableKeys: -item.quantity } },
        { session },
      )

      if (counter.modifiedCount !== 1) {
        throw new OrderConflict('OUT_OF_STOCK', {
          variantId: String(item.variantId),
        })
      }

      const keys = await ProductKey.find(
        { variantId: item.variantId, status: KEY_STATUS.AVAILABLE },
        { _id: 1 },
        { session },
      )
        .sort({ _id: 1 })
        .limit(item.quantity)
        .lean()

      if (keys.length !== item.quantity) {
        // The counter said there were enough, the keys say otherwise: the
        // two drifted apart. Refuse rather than sell keys that do not exist.
        throw new OrderConflict('STOCK_MISMATCH', {
          variantId: String(item.variantId),
        })
      }

      const reserved = await ProductKey.updateMany(
        {
          _id: { $in: keys.map((key) => key._id) },
          status: KEY_STATUS.AVAILABLE,
        },
        {
          $set: {
            status: KEY_STATUS.RESERVED,
            orderId: created._id,
            reservedAt: now,
          },
        },
        { session },
      )

      if (reserved.modifiedCount !== item.quantity) {
        throw new OrderConflict('STOCK_MISMATCH', {
          variantId: String(item.variantId),
        })
      }
    }

    return created.toObject()
  })
}

/**
 * Ends a pending order (`cancelled` or `expired`). The status change is
 * conditional on the order still being pending, so of a cancel, an expiry and
 * a payment arriving together only the first takes effect.
 *
 * Its keys are not handed back here: they stay reserved until
 * `keysReleaseAfter`, in case a payment made just before the end is still on
 * its way (see `releaseHeldKeys`). Answers the updated order, or `null` when
 * it was no longer pending.
 */
export function closePendingOrder({
  orderId,
  userId,
  status,
  at,
  releaseAfter,
}) {
  const filter = { _id: orderId, status: ORDER_STATUS.PENDING }

  if (userId) filter.userId = userId

  return Order.findOneAndUpdate(
    filter,
    {
      $set: {
        status,
        [status === ORDER_STATUS.CANCELLED ? 'cancelledAt' : 'expiredAt']: at,
        keysReleaseAfter: releaseAfter,
      },
    },
    { returnDocument: 'after', lean: true },
  )
}

/** Pending orders whose time ran out, oldest first. */
export function findOverduePendingOrderIds({ now, limit }) {
  return Order.find(
    { status: ORDER_STATUS.PENDING, expiresAt: { $lte: now } },
    { _id: 1 },
  )
    .sort({ expiresAt: 1 })
    .limit(limit)
    .lean()
}

/**
 * Ended orders whose keys can go back on sale, oldest first. A paid order
 * never has `keysReleaseAfter` set, so its keys are never picked up.
 */
export function findOrdersWithKeysToRelease({ now, limit }) {
  return Order.find(
    {
      status: { $in: [ORDER_STATUS.EXPIRED, ORDER_STATUS.CANCELLED] },
      keysReleasedAt: null,
      keysReleaseAfter: { $lte: now },
    },
    { _id: 1 },
  )
    .sort({ keysReleaseAfter: 1 })
    .limit(limit)
    .lean()
}

/**
 * Puts an ended order's reserved keys back on sale, once. Marking the order
 * as released is the first, conditional write: a second sweeper (another API
 * instance) racing for the same order finds it already marked and its
 * transaction does nothing, so the counters can never be credited twice.
 */
export function releaseHeldKeys(orderId) {
  return inTransaction(async (session) => {
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: { $in: [ORDER_STATUS.EXPIRED, ORDER_STATUS.CANCELLED] },
        keysReleasedAt: null,
      },
      { $set: { keysReleasedAt: new Date() } },
      { session, returnDocument: 'after', lean: true },
    )

    if (!order) return 0

    const keys = await ProductKey.find(
      { orderId, status: KEY_STATUS.RESERVED },
      { _id: 1, variantId: 1 },
      { session },
    ).lean()

    if (!keys.length) return 0

    await ProductKey.updateMany(
      { _id: { $in: keys.map((key) => key._id) } },
      {
        $set: { status: KEY_STATUS.AVAILABLE, orderId: null, reservedAt: null },
      },
      { session },
    )

    const perVariant = new Map()

    for (const key of keys) {
      const id = String(key.variantId)
      perVariant.set(id, (perVariant.get(id) ?? 0) + 1)
    }

    await ProductVariant.bulkWrite(
      [...perVariant].map(([variantId, count]) => ({
        updateOne: {
          filter: { _id: variantId },
          update: { $inc: { availableKeys: count } },
        },
      })),
      { session },
    )

    return keys.length
  })
}

/**
 * Records that `paymentId` paid for its order and hands over the keys, all in
 * one transaction. Answers what happened, for the payment service to report:
 *
 * - `paid`: the order is now paid by this payment and its keys are sold;
 * - `already_paid_by_this`: this payment had already been applied (VNPay's
 *   IPN and the shopper's return both confirming the same payment);
 * - `refund_required`: the money arrived but nothing can be delivered for it,
 *   either because the order was already paid by another payment or because
 *   its keys went back on sale and too few are left to hold again. The
 *   payment is marked for a refund and the order is left as it was.
 *
 * Only the order's own status change decides who wins: it is conditional on
 * the order not being paid yet, so of two confirmations running at once
 * (two IPNs, IPN and return, two different payments) exactly one commits the
 * `paid` change and the other finds it already done when MongoDB makes it
 * retry.
 */
export function confirmOrderPayment({ paymentId, paidAt, providerDetails }) {
  return inTransaction(async (session) => {
    const payment = await Payment.findById(paymentId, null, { session }).lean()

    if (!payment) throw new Error(`Payment ${paymentId} not found`)

    if (payment.status === PAYMENT_STATUS.SUCCEEDED) {
      return { outcome: 'already_paid_by_this', payment }
    }

    if (payment.status === PAYMENT_STATUS.REFUND_REQUIRED) {
      return { outcome: 'refund_required', payment }
    }

    const order = await Order.findById(payment.orderId, null, {
      session,
    }).lean()

    const refund = async (reason) => {
      const updated = await Payment.findOneAndUpdate(
        { _id: paymentId },
        {
          $set: {
            status: PAYMENT_STATUS.REFUND_REQUIRED,
            refundReason: reason,
            paidAt,
            settledAt: new Date(),
            ...providerDetails,
          },
        },
        { session, returnDocument: 'after', lean: true },
      )

      return { outcome: 'refund_required', payment: updated, order }
    }

    if (order.status === ORDER_STATUS.PAID) {
      return refund('Order was already paid by another payment')
    }

    // Keys still held for this order (pending, or ended but not yet
    // released) are sold as they are. Keys already released must be held
    // again from what is left on sale.
    const held = await ProductKey.find(
      { orderId: order._id, status: KEY_STATUS.RESERVED },
      { _id: 1, variantId: 1 },
      { session },
    ).lean()
    const heldPerVariant = new Map()

    for (const key of held) {
      const id = String(key.variantId)
      heldPerVariant.set(id, (heldPerVariant.get(id) ?? 0) + 1)
    }

    const now = new Date()

    for (const item of order.items) {
      const missing =
        item.quantity - (heldPerVariant.get(String(item.variantId)) ?? 0)

      if (missing <= 0) continue

      const counter = await ProductVariant.updateOne(
        { _id: item.variantId, availableKeys: { $gte: missing } },
        { $inc: { availableKeys: -missing } },
        { session },
      )

      if (counter.modifiedCount !== 1) {
        // Undoes the holds made for earlier lines in this transaction.
        throw new RefundNeeded('Keys sold out before the payment arrived')
      }

      const keys = await ProductKey.find(
        { variantId: item.variantId, status: KEY_STATUS.AVAILABLE },
        { _id: 1 },
        { session },
      )
        .sort({ _id: 1 })
        .limit(missing)
        .lean()

      if (keys.length !== missing) {
        throw new RefundNeeded('Key counter disagrees with stocked keys')
      }

      await ProductKey.updateMany(
        { _id: { $in: keys.map((key) => key._id) } },
        {
          $set: {
            status: KEY_STATUS.RESERVED,
            orderId: order._id,
            reservedAt: now,
          },
        },
        { session },
      )
    }

    const paid = await Order.findOneAndUpdate(
      { _id: order._id, status: { $ne: ORDER_STATUS.PAID } },
      {
        $set: {
          status: ORDER_STATUS.PAID,
          paidAt,
          paymentId,
          // An ended order revived by a late payment keeps its keys for good.
          keysReleaseAfter: null,
          keysReleasedAt: null,
        },
      },
      { session, returnDocument: 'after', lean: true },
    )

    if (!paid) return refund('Order was already paid by another payment')

    const sold = await ProductKey.updateMany(
      { orderId: order._id, status: KEY_STATUS.RESERVED },
      { $set: { status: KEY_STATUS.SOLD, soldAt: now } },
      { session },
    )

    if (sold.modifiedCount !== order.itemCount) {
      throw new Error(
        `Order ${order.number} sold ${sold.modifiedCount} keys for ${order.itemCount} items`,
      )
    }

    const succeeded = await Payment.findOneAndUpdate(
      { _id: paymentId },
      {
        $set: {
          status: PAYMENT_STATUS.SUCCEEDED,
          paidAt,
          settledAt: now,
          ...providerDetails,
        },
      },
      { session, returnDocument: 'after', lean: true },
    )

    return { outcome: 'paid', payment: succeeded, order: paid }
  }).catch(async (error) => {
    if (!(error instanceof RefundNeeded)) throw error

    // The transaction was rolled back, so the refund mark is written on its
    // own. It is conditional on the payment still being pending, so it can
    // never overwrite a success recorded in the meantime.
    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId, status: PAYMENT_STATUS.PENDING },
      {
        $set: {
          status: PAYMENT_STATUS.REFUND_REQUIRED,
          refundReason: error.message,
          paidAt,
          settledAt: new Date(),
          ...providerDetails,
        },
      },
      { returnDocument: 'after', lean: true },
    )

    return payment
      ? { outcome: 'refund_required', payment }
      : confirmOrderPayment({ paymentId, paidAt, providerDetails })
  })
}

class RefundNeeded extends Error {}

export function createPayment(payment) {
  return Payment.create(payment).then((created) => created.toObject())
}

export function findPaymentByTxnRef(txnRef) {
  return Payment.findOne({ txnRef }).lean()
}

/** Marks a pending payment failed; a settled one is left as it is. */
export function markPaymentFailed({ paymentId, providerDetails }) {
  return Payment.findOneAndUpdate(
    { _id: paymentId, status: PAYMENT_STATUS.PENDING },
    {
      $set: {
        status: PAYMENT_STATUS.FAILED,
        settledAt: new Date(),
        ...providerDetails,
      },
    },
    { returnDocument: 'after', lean: true },
  )
}

/** The latest payments of an order, newest first. */
export function findOrderPayments(orderId) {
  return Payment.find({ orderId }).sort({ createdAt: -1 }).limit(20).lean()
}

/** Marks the keys email as sent; answers `false` if it already was. */
export async function markKeysEmailed(orderId) {
  const result = await Order.updateOne(
    { _id: orderId, keysEmailedAt: null },
    { $set: { keysEmailedAt: new Date() } },
  )

  return result.modifiedCount === 1
}

export function findOrderById(orderId) {
  return Order.findById(orderId).lean()
}

export function findUserOrderByNumber(userId, number) {
  return Order.findOne({ userId, number }).lean()
}

export function findUserOrderByIdempotencyKey(userId, idempotencyKey) {
  return Order.findOne({ userId, idempotencyKey }).lean()
}

export function findPendingUserOrder(userId) {
  return Order.findOne({ userId, status: ORDER_STATUS.PENDING }).lean()
}

export async function findUserOrders({ userId, page, limit }) {
  const filter = { userId }
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ])

  return { orders, total }
}

/** Codes of the keys sold to a paid order, still encrypted. */
export function findSoldKeys(orderId) {
  return ProductKey.find(
    { orderId, status: KEY_STATUS.SOLD },
    { variantId: 1, codeEncrypted: 1 },
  )
    .sort({ _id: 1 })
    .lean()
}
