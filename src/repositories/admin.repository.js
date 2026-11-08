import { ORDER_STATUS, PAYMENT_STATUS } from '#constants/order.js'
import { ContactMessage } from '#models/contact-message.model.js'
import { Order } from '#models/order.model.js'
import { Payment } from '#models/payment.model.js'
import { Product } from '#models/product.model.js'
import { ProductVariant } from '#models/product-variant.model.js'
import { User } from '#models/user.model.js'

// Lean reads throughout: admin responses are built by the service, which
// decides field by field what leaves the API.

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsPattern(search) {
  return new RegExp(escapeRegExp(search), 'i')
}

async function paginate(model, filter, { page, limit, sort }) {
  const [items, total] = await Promise.all([
    model
      .find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    model.countDocuments(filter),
  ])

  return { items, total }
}

async function countByStatus(model, statuses) {
  const rows = await model.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]))

  for (const row of rows) {
    if (row._id in counts) counts[row._id] = row.count
  }

  return counts
}

export async function getOverview({ since, lowStockThreshold }) {
  const [
    orderCounts,
    revenue,
    recentRevenue,
    users,
    newUsers,
    products,
    publishedProducts,
    lowStockVariants,
    refundsRequired,
    newMessages,
  ] = await Promise.all([
    countByStatus(Order, Object.values(ORDER_STATUS)),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.PAID } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Order.aggregate([
      { $match: { status: ORDER_STATUS.PAID, paidAt: { $gte: since } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: since } }),
    Product.countDocuments(),
    Product.countDocuments({ published: true }),
    ProductVariant.countDocuments({
      availableKeys: { $lte: lowStockThreshold },
    }),
    Payment.countDocuments({
      status: PAYMENT_STATUS.REFUND_REQUIRED,
      refundedAt: null,
    }),
    ContactMessage.countDocuments({ status: 'new' }),
  ])

  return {
    orderCounts,
    revenue: revenue[0]?.total ?? 0,
    recentRevenue: recentRevenue[0]?.total ?? 0,
    recentPaidOrders: recentRevenue[0]?.count ?? 0,
    users,
    newUsers,
    products,
    publishedProducts,
    lowStockVariants,
    refundsRequired,
    newMessages,
  }
}

export function findRecentOrders(limit) {
  return Order.find().sort({ createdAt: -1, _id: -1 }).limit(limit).lean()
}

/** Ids of the accounts whose address or name contains `search`. */
async function findUserIdsMatching(search, limit = 200) {
  const pattern = containsPattern(search)
  const users = await User.find({
    $or: [{ email: pattern }, { displayName: pattern }],
  })
    .select('_id')
    .limit(limit)
    .lean()

  return users.map((user) => user._id)
}

export async function findOrders({ page, limit, status, search }) {
  const filter = {}

  if (status) filter.status = status

  if (search) {
    filter.$or = [
      { number: containsPattern(search) },
      { userId: { $in: await findUserIdsMatching(search) } },
    ]
  }

  const { items, total } = await paginate(Order, filter, {
    page,
    limit,
    sort: { createdAt: -1, _id: -1 },
  })

  return { orders: items, total }
}

export function findOrderByNumber(number) {
  return Order.findOne({ number }).lean()
}

export function findOrderPayments(orderId) {
  return Payment.find({ orderId }).sort({ createdAt: -1 }).lean()
}

/**
 * `refund_required` lists only the refunds still owed; `refunded` is a view
 * of the ones already paid back, which keep that status.
 */
export async function findPayments({ page, limit, status }) {
  let filter = {}

  if (status === 'refunded') {
    filter = {
      status: PAYMENT_STATUS.REFUND_REQUIRED,
      refundedAt: { $ne: null },
    }
  } else if (status === PAYMENT_STATUS.REFUND_REQUIRED) {
    filter = { status, refundedAt: null }
  } else if (status) {
    filter = { status }
  }

  const { items, total } = await paginate(Payment, filter, {
    page,
    limit,
    sort: { createdAt: -1, _id: -1 },
  })

  return { payments: items, total }
}

export function findPaymentById(paymentId) {
  return Payment.findById(paymentId).lean()
}

/**
 * Records that an owed refund was paid back by hand. Conditional on it still
 * being owed, so two admins clicking at once record it once.
 */
export function markPaymentRefunded({ paymentId, adminId, note, at }) {
  return Payment.findOneAndUpdate(
    {
      _id: paymentId,
      status: PAYMENT_STATUS.REFUND_REQUIRED,
      refundedAt: null,
    },
    { $set: { refundedAt: at, refundedBy: adminId, refundNote: note } },
    { returnDocument: 'after', lean: true },
  )
}

export function findOrdersByIds(orderIds) {
  return Order.find({ _id: { $in: orderIds } })
    .select('number status total')
    .lean()
}

export function findUsersByIds(userIds) {
  return User.find({ _id: { $in: userIds } })
    .select('email displayName role')
    .lean()
}

export function findUserById(userId) {
  return User.findById(userId).lean()
}

export async function findUsers({ page, limit, role, search }) {
  const filter = {}

  if (role) filter.role = role

  if (search) {
    const pattern = containsPattern(search)

    filter.$or = [{ email: pattern }, { displayName: pattern }]
  }

  const { items, total } = await paginate(User, filter, {
    page,
    limit,
    sort: { createdAt: -1, _id: -1 },
  })

  return { users: items, total }
}

/** Order count and amount paid per account, for the listed accounts only. */
export async function summarizeUserOrders(userIds) {
  const rows = await Order.aggregate([
    { $match: { userId: { $in: userIds } } },
    {
      $group: {
        _id: '$userId',
        orders: { $sum: 1 },
        spent: {
          $sum: {
            $cond: [{ $eq: ['$status', ORDER_STATUS.PAID] }, '$total', 0],
          },
        },
      },
    },
  ])

  return new Map(rows.map((row) => [String(row._id), row]))
}

export function findUserOrders(userId, limit) {
  return Order.find({ userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
}
