import mongoose from 'mongoose'
import { ORDER_CURRENCY, ORDER_STATUS } from '#constants/order.js'
import { imageSchema } from './schemas/image.schema.js'

/**
 * A line as it was when the order was placed. Names and prices are copied,
 * so later catalogue changes never alter what the shopper agreed to pay.
 */
const orderItemSchema = new mongoose.Schema(
  {
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productSlug: { type: String, required: true },
    productName: { type: String, required: true },
    image: { type: imageSchema, required: true },
    platform: {
      name: { type: String, required: true },
      slug: { type: String, required: true },
    },
    edition: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, default: null },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    // Shown to the shopper and sent to the payment gateway as the reference.
    number: { type: String, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
    items: { type: [orderItemSchema], required: true },
    itemCount: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: ORDER_CURRENCY },
    // Sent by the client with each checkout attempt, so a repeated request
    // (double click, retry after a timeout) returns the same order.
    idempotencyKey: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    // An expired or cancelled order keeps its keys until this moment, then
    // hands them back once (`keysReleasedAt`).
    keysReleaseAfter: { type: Date, default: null },
    keysReleasedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'orders' },
)

orderSchema.index({ number: 1 }, { unique: true })
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true })
// At most one unpaid order per shopper, enforced by the database itself so
// two checkouts racing each other cannot both succeed.
orderSchema.index(
  { userId: 1 },
  {
    name: 'one_pending_order_per_user',
    unique: true,
    partialFilterExpression: { status: ORDER_STATUS.PENDING },
  },
)
orderSchema.index({ userId: 1, createdAt: -1 })
orderSchema.index({ status: 1, expiresAt: 1 })
orderSchema.index({ keysReleasedAt: 1, keysReleaseAfter: 1 })

export const Order = mongoose.model('Order', orderSchema)
