import mongoose from 'mongoose'
import { PAYMENT_PROVIDER, PAYMENT_STATUS } from '#constants/order.js'

/**
 * One attempt to pay for an order. Each click on "Pay" is its own payment
 * with its own `txnRef`, the reference VNPay knows it by, so a shopper who
 * pays twice for one order leaves two records and the second can be refunded.
 */
const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: String,
      enum: Object.values(PAYMENT_PROVIDER),
      required: true,
    },
    txnRef: { type: String, required: true },
    // Whole VND, as on the order.
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    expiresAt: { type: Date, required: true },
    // What VNPay reported, kept for support and reconciliation.
    providerTransactionNo: { type: String, default: null },
    bankCode: { type: String, default: null },
    responseCode: { type: String, default: null },
    paidAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },
    // Why a refund is owed, when `status` is `refund_required`.
    refundReason: { type: String, default: null },
    // Set by an admin once the money was paid back by hand. The status stays
    // `refund_required`, so the record still says why the money was owed.
    refundedAt: { type: Date, default: null },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    refundNote: { type: String, default: null },
  },
  { timestamps: true, collection: 'payments' },
)

paymentSchema.index({ txnRef: 1 }, { unique: true })
paymentSchema.index({ orderId: 1, createdAt: -1 })
paymentSchema.index({ status: 1, createdAt: -1 })

export const Payment = mongoose.model('Payment', paymentSchema)
