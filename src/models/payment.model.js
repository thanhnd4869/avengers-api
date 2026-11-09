import mongoose from 'mongoose'
import {
  PAYMENT_PROVIDER,
  PAYMENT_REFUND_STATUS,
  PAYMENT_STATUS,
} from '#constants/order.js'

const refundAttemptSchema = new mongoose.Schema(
  {
    requestId: { type: String, default: null },
    method: { type: String, enum: ['manual', 'vnpay'], required: true },
    status: {
      type: String,
      enum: [
        PAYMENT_REFUND_STATUS.PROCESSING,
        PAYMENT_REFUND_STATUS.FAILED,
        PAYMENT_REFUND_STATUS.UNKNOWN,
        PAYMENT_REFUND_STATUS.SUCCEEDED,
      ],
      required: true,
    },
    attemptedAt: { type: Date, required: true },
    responseCode: { type: String, default: null },
    providerTransactionNo: { type: String, default: null },
    error: { type: String, default: null },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: { type: String, default: null },
  },
  { _id: false },
)

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
    refundStatus: {
      type: String,
      enum: Object.values(PAYMENT_REFUND_STATUS),
      default: PAYMENT_REFUND_STATUS.NONE,
    },
    refundMethod: { type: String, enum: ['manual', 'vnpay'], default: null },
    refundRequestId: { type: String, default: null },
    refundAttemptedAt: { type: Date, default: null },
    refundResponseCode: { type: String, default: null },
    refundProviderTransactionNo: { type: String, default: null },
    refundError: { type: String, default: null },
    refundAttempts: { type: [refundAttemptSchema], default: [] },
    // The payment status remains `refund_required` to preserve why the money
    // was owed; refundStatus tracks whether it was paid back.
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
