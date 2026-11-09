import { ERROR_CODE } from '#constants/error-code.js'
import {
  ORDER_STATUS,
  PAYMENT_PROVIDER,
  PAYMENT_REFUND_STATUS,
  PAYMENT_STATUS,
} from '#constants/order.js'
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from '#errors/app-error.js'
import {
  parseAdminOrderNumber,
  validateAdminOrderListQuery,
  validateAdminPaymentListQuery,
  validateAdminUserListQuery,
  validateObjectId,
  validateOverviewQuery,
} from '#validations/admin.validation.js'
import { validateRefundBody } from '#validations/admin-catalogue.validation.js'
import { toPaginatedResponse } from './pagination.js'

const DAY = 24 * 60 * 60 * 1000
const LOW_STOCK_THRESHOLD = 5
const RECENT_ORDERS = 8
const USER_RECENT_ORDERS = 10

function toCustomer(user) {
  return user
    ? {
        id: String(user._id),
        email: user.email,
        displayName: user.displayName,
      }
    : null
}

/**
 * An admin's view of an order. Key codes are deliberately left out: support
 * work never needs them, and the buyer already has them by email.
 */
function toAdminOrder(order, customer, now = new Date()) {
  return {
    id: String(order._id),
    number: order.number,
    status: order.status,
    // A pending order past its deadline that no sweep has closed yet.
    overdue: order.status === ORDER_STATUS.PENDING && order.expiresAt <= now,
    customer: toCustomer(customer),
    itemCount: order.itemCount,
    total: order.total,
    currency: order.currency,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    expiredAt: order.expiredAt,
    keysEmailedAt: order.keysEmailedAt,
  }
}

function toAdminOrderItem(item) {
  return {
    variantId: String(item.variantId),
    product: {
      slug: item.productSlug,
      name: item.productName,
      image: item.image,
    },
    platform: item.platform,
    edition: item.edition,
    unitPrice: item.unitPrice,
    originalPrice: item.originalPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
  }
}

function toAdminPayment(payment, { order, customer } = {}) {
  return {
    id: String(payment._id),
    provider: payment.provider,
    txnRef: payment.txnRef,
    amount: payment.amount,
    status: payment.status,
    providerTransactionNo: payment.providerTransactionNo,
    bankCode: payment.bankCode,
    responseCode: payment.responseCode,
    refundReason: payment.refundReason,
    refundStatus:
      payment.refundStatus ??
      (payment.refundedAt
        ? PAYMENT_REFUND_STATUS.SUCCEEDED
        : PAYMENT_REFUND_STATUS.NONE),
    refundMethod: payment.refundMethod ?? null,
    refundAttemptedAt: payment.refundAttemptedAt ?? null,
    refundResponseCode: payment.refundResponseCode ?? null,
    refundProviderTransactionNo: payment.refundProviderTransactionNo ?? null,
    refundError: payment.refundError ?? null,
    refundAttempts: (payment.refundAttempts ?? []).map((attempt) => ({
      requestId: attempt.requestId ?? null,
      method: attempt.method,
      status: attempt.status,
      attemptedAt: attempt.attemptedAt,
      responseCode: attempt.responseCode ?? null,
      providerTransactionNo: attempt.providerTransactionNo ?? null,
      error: attempt.error ?? null,
      adminId: attempt.adminId ? String(attempt.adminId) : null,
      note: attempt.note ?? null,
    })),
    refundedAt: payment.refundedAt ?? null,
    refundNote: payment.refundNote ?? null,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
    settledAt: payment.settledAt,
    ...(order !== undefined && {
      order: order ? { number: order.number, status: order.status } : null,
    }),
    ...(customer !== undefined && { customer: toCustomer(customer) }),
  }
}

/** Never the password hash: fields are copied one by one. */
function toAdminUser(user, summary) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPassword: user.hasPassword,
    createdAt: user.createdAt,
    orderCount: summary?.orders ?? 0,
    totalSpent: summary?.spent ?? 0,
  }
}

export function createAdminService({ adminRepository, vnpay, logger }) {
  async function customersFor(records) {
    const ids = [...new Set(records.map((record) => String(record.userId)))]
    const users = ids.length ? await adminRepository.findUsersByIds(ids) : []

    return new Map(users.map((user) => [String(user._id), user]))
  }

  return {
    async getOverview(query) {
      const { days } = validateOverviewQuery(query)
      const since = new Date(Date.now() - days * DAY)
      const [overview, recentOrders] = await Promise.all([
        adminRepository.getOverview({
          since,
          lowStockThreshold: LOW_STOCK_THRESHOLD,
        }),
        adminRepository.findRecentOrders(RECENT_ORDERS),
      ])
      const customers = await customersFor(recentOrders)

      return {
        data: {
          days,
          lowStockThreshold: LOW_STOCK_THRESHOLD,
          ...overview,
          recentOrders: recentOrders.map((order) =>
            toAdminOrder(order, customers.get(String(order.userId))),
          ),
        },
      }
    },

    async listOrders(query) {
      const { page, limit, status, search } = validateAdminOrderListQuery(query)
      const { orders, total } = await adminRepository.findOrders({
        page,
        limit,
        status,
        search,
      })
      const customers = await customersFor(orders)

      return toPaginatedResponse(
        orders.map((order) =>
          toAdminOrder(order, customers.get(String(order.userId))),
        ),
        { page, limit, total },
      )
    },

    async getOrder(rawNumber) {
      const number = parseAdminOrderNumber(rawNumber)
      const order = number
        ? await adminRepository.findOrderByNumber(number)
        : null

      if (!order) throw new NotFoundError('Order not found.')

      const [customer, payments] = await Promise.all([
        adminRepository.findUserById(order.userId),
        adminRepository.findOrderPayments(order._id),
      ])

      return {
        data: {
          ...toAdminOrder(order, customer),
          items: order.items.map(toAdminOrderItem),
          payments: payments.map((payment) => toAdminPayment(payment)),
        },
      }
    },

    async listPayments(query) {
      const { page, limit, status } = validateAdminPaymentListQuery(query)
      const { payments, total } = await adminRepository.findPayments({
        page,
        limit,
        status,
      })
      const orderIds = [...new Set(payments.map((p) => String(p.orderId)))]
      const [orders, customers] = await Promise.all([
        orderIds.length ? adminRepository.findOrdersByIds(orderIds) : [],
        customersFor(payments),
      ])
      const ordersById = new Map(orders.map((o) => [String(o._id), o]))

      return toPaginatedResponse(
        payments.map((payment) =>
          toAdminPayment(payment, {
            order: ordersById.get(String(payment.orderId)) ?? null,
            customer: customers.get(String(payment.userId)) ?? null,
          }),
        ),
        { page, limit, total },
      )
    },

    async listUsers(query) {
      const { page, limit, role, search } = validateAdminUserListQuery(query)
      const { users, total } = await adminRepository.findUsers({
        page,
        limit,
        role,
        search,
      })
      const summaries = users.length
        ? await adminRepository.summarizeUserOrders(users.map((u) => u._id))
        : new Map()

      return toPaginatedResponse(
        users.map((user) => toAdminUser(user, summaries.get(String(user._id)))),
        { page, limit, total },
      )
    },

    async getUser(rawId) {
      const id = validateObjectId(rawId)
      const user = await adminRepository.findUserById(id)

      if (!user) throw new NotFoundError('User not found.')

      const [summaries, orders] = await Promise.all([
        adminRepository.summarizeUserOrders([user._id]),
        adminRepository.findUserOrders(user._id, USER_RECENT_ORDERS),
      ])

      return {
        data: {
          ...toAdminUser(user, summaries.get(String(user._id))),
          pendingEmail: user.pendingEmail,
          recentOrders: orders.map((order) => toAdminOrder(order, user)),
        },
      }
    },

    /**
     * Records a refund paid back outside the system (VNPay merchant portal or
     * bank transfer). Nothing is sent to VNPay from here.
     */
    async markPaymentRefunded(rawId, body, { adminId }) {
      const id = validateObjectId(rawId)
      const { note } = validateRefundBody(body)
      const payment = await adminRepository.markPaymentRefunded({
        paymentId: id,
        adminId,
        note,
        at: new Date(),
      })

      if (!payment) {
        const existing = await adminRepository.findPaymentById(id)

        if (!existing) throw new NotFoundError('Payment not found.')

        const message =
          existing.refundStatus === PAYMENT_REFUND_STATUS.PROCESSING
            ? 'A refund request is already being processed.'
            : existing.refundStatus === PAYMENT_REFUND_STATUS.UNKNOWN
              ? 'The prior refund result is unknown; reconcile it before recording a manual refund.'
              : existing.refundedAt
                ? 'This refund was already recorded.'
                : 'This payment is not owed back.'

        throw new ConflictError(message, { code: ERROR_CODE.REFUND_NOT_OWED })
      }

      return { data: toAdminPayment(payment) }
    },

    /**
     * Sends one full-refund request to VNPay. A timeout is recorded as
     * `unknown`, since the provider may have processed a request whose reply
     * did not reach us; it must be reconciled before another attempt.
     */
    async refundPaymentViaVnpay(rawId, body, { adminId, ipAddr }) {
      if (!vnpay) {
        throw new ServiceUnavailableError('VNPay is not configured.')
      }

      const id = validateObjectId(rawId)
      const { note } = validateRefundBody(body)
      const existing = await adminRepository.findPaymentById(id)

      if (!existing) throw new NotFoundError('Payment not found.')
      if (existing.provider !== PAYMENT_PROVIDER.VNPAY) {
        throw new ConflictError(
          'Only VNPay payments can be refunded through VNPay.',
          {
            code: ERROR_CODE.REFUND_NOT_OWED,
          },
        )
      }
      if (
        existing.status !== PAYMENT_STATUS.REFUND_REQUIRED ||
        existing.refundedAt
      ) {
        throw new ConflictError('This payment is not owed back.', {
          code: ERROR_CODE.REFUND_NOT_OWED,
        })
      }
      if (
        existing.refundStatus === PAYMENT_REFUND_STATUS.PROCESSING ||
        existing.refundStatus === PAYMENT_REFUND_STATUS.UNKNOWN
      ) {
        throw new ConflictError(
          'A previous refund attempt is still being processed or has an unknown result. Reconcile it with VNPay before retrying.',
          { code: ERROR_CODE.REFUND_RESULT_UNKNOWN },
        )
      }
      if (!existing.providerTransactionNo || !existing.createdAt) {
        throw new ConflictError(
          'VNPay transaction details are missing; this refund must be reconciled manually.',
          { code: ERROR_CODE.REFUND_NOT_OWED },
        )
      }

      const requestId = vnpay.createRefundRequestId()
      const payment = await adminRepository.beginVnpayRefund({
        paymentId: id,
        adminId,
        requestId,
        note,
        at: new Date(),
      })

      if (!payment) {
        throw new ConflictError(
          'This refund is already being handled or is no longer owed.',
          { code: ERROR_CODE.REFUND_NOT_OWED },
        )
      }

      let reply

      try {
        reply = await vnpay.refundTransaction({
          requestId,
          txnRef: payment.txnRef,
          amount: payment.amount,
          transactionNo: payment.providerTransactionNo,
          // VNPay matches this against the `vnp_CreateDate` of the pay request.
          transactionDate: payment.createdAt,
          orderInfo: `Refund payment ${payment.txnRef}`,
          createdBy: String(adminId),
          ipAddr,
        })
      } catch (error) {
        logger.error(
          { err: error, paymentId: id, txnRef: payment.txnRef, requestId },
          'VNPay refund result is unknown',
        )

        try {
          await adminRepository.markVnpayRefundUnknown({
            paymentId: id,
            requestId,
            error:
              'Could not verify the VNPay refund response; reconcile before retrying.',
          })
        } catch (recordError) {
          logger.error(
            { err: recordError, paymentId: id, txnRef: payment.txnRef },
            'Could not record the unknown VNPay refund result',
          )
        }

        throw new ServiceUnavailableError(
          'Could not confirm the refund result with VNPay. Do not retry until the transaction has been reconciled.',
          { code: ERROR_CODE.REFUND_RESULT_UNKNOWN },
        )
      }

      if (reply.vnp_ResponseCode !== '00') {
        const providerMessage = String(reply.vnp_Message || 'Request rejected')
          .replace(/[<>]/g, '')
          .slice(0, 200)

        const failed = await adminRepository.failVnpayRefund({
          paymentId: id,
          requestId,
          responseCode: reply.vnp_ResponseCode,
          error: providerMessage,
        })

        if (!failed) {
          logger.error(
            { paymentId: id, txnRef: payment.txnRef, requestId },
            'VNPay rejected refund but the result could not be recorded',
          )
          throw new ServiceUnavailableError(
            'VNPay rejected the refund, but the result could not be recorded. Reconcile before retrying.',
            { code: ERROR_CODE.REFUND_RESULT_UNKNOWN },
          )
        }

        throw new ConflictError(
          `VNPay did not accept the refund: ${providerMessage}`,
          {
            code: ERROR_CODE.REFUND_REJECTED,
          },
        )
      }

      let refunded

      try {
        refunded = await adminRepository.finishVnpayRefund({
          paymentId: id,
          requestId,
          responseCode: reply.vnp_ResponseCode,
          refundTransactionNo: reply.vnp_TransactionNo,
          at: new Date(),
        })
      } catch (error) {
        logger.error(
          { err: error, paymentId: id, txnRef: payment.txnRef, requestId },
          'VNPay accepted refund but local payment state could not be updated',
        )
        throw new ServiceUnavailableError(
          'VNPay accepted the refund, but the result could not be recorded. Reconcile before retrying.',
          { code: ERROR_CODE.REFUND_RESULT_UNKNOWN },
        )
      }

      if (!refunded) {
        logger.error(
          { paymentId: id, txnRef: payment.txnRef, requestId },
          'VNPay accepted refund but local payment state could not be updated',
        )
        throw new ServiceUnavailableError(
          'VNPay accepted the refund, but the result could not be recorded. Reconcile before retrying.',
          { code: ERROR_CODE.REFUND_RESULT_UNKNOWN },
        )
      }

      logger.info(
        {
          paymentId: id,
          txnRef: payment.txnRef,
          requestId,
          refundTransactionNo: reply.vnp_TransactionNo,
          adminId,
        },
        'VNPay refund completed',
      )

      return { data: toAdminPayment(refunded) }
    },
  }
}
