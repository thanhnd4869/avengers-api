import { randomBytes } from 'node:crypto'
import { ERROR_CODE } from '#constants/error-code.js'
import {
  ORDER_STATUS,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
} from '#constants/order.js'
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '#errors/app-error.js'
import { HTTP_STATUS } from '#constants/http-status.js'
import { parseOrderNumber } from '#validations/order.validation.js'
import { orderKeysEmail } from '#utils/emails/order-keys.email.js'
import { parseVnpayDate } from '#utils/vnpay.js'

const SECOND = 1000
// VNPay needs time to show its page and the shopper time to pay; a payment
// started with less than this left on the hold would likely fail anyway.
const MIN_PAYMENT_WINDOW_MS = 60 * SECOND

// VNPay's IPN answers, as its integration guide lists them. 00 and 02 end
// VNPay's retries; the others make it call again (up to 10 times, 5 minutes
// apart).
const IPN = Object.freeze({
  CONFIRMED: { RspCode: '00', Message: 'Confirm Success' },
  ALREADY_CONFIRMED: { RspCode: '02', Message: 'Order already confirmed' },
  NOT_FOUND: { RspCode: '01', Message: 'Order not found' },
  INVALID_AMOUNT: { RspCode: '04', Message: 'Invalid amount' },
  INVALID_SIGNATURE: { RspCode: '97', Message: 'Invalid signature' },
  UNKNOWN_ERROR: { RspCode: '99', Message: 'Unknown error' },
})

function generateTxnRef(orderNumber) {
  // Unique per attempt, readable alongside the order number in VNPay's
  // merchant portal.
  return `${orderNumber.replaceAll('-', '')}${randomBytes(4).toString('hex').toUpperCase()}`
}

function providerDetailsFrom(params) {
  return {
    providerTransactionNo: params.vnp_TransactionNo || null,
    bankCode: params.vnp_BankCode || null,
    responseCode:
      params.vnp_ResponseCode ?? params.vnp_TransactionStatus ?? null,
  }
}

function isSuccess(params) {
  return (
    params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00'
  )
}

export function createPaymentService({
  orderRepository,
  cartService,
  vnpay,
  keyCipher,
  userRepository,
  mailer,
  appUrl,
  apiUrl,
  logger,
}) {
  function paymentUnavailable() {
    return new AppError(
      'Online payment is not available right now.',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      { code: ERROR_CODE.PAYMENT_UNAVAILABLE },
    )
  }

  /**
   * The work that follows a successful confirmation: the bought games leave
   * the cart and the keys are emailed. Neither may undo the payment, so a
   * failure is logged and the shopper still has the keys in their account.
   */
  async function afterPaid(order) {
    try {
      await cartService.removeVariants(
        order.userId,
        order.items.map((item) => item.variantId),
      )
    } catch (error) {
      logger.error(
        { err: error, order: order.number },
        'Could not tidy the cart after payment',
      )
    }

    try {
      const user = await userRepository.findUserById(order.userId)

      if (!user?.email || !(await orderRepository.markKeysEmailed(order._id))) {
        return
      }

      const keys = new Map()

      for (const key of await orderRepository.findSoldKeys(order._id)) {
        const id = String(key.variantId)
        keys.set(id, [
          ...(keys.get(id) ?? []),
          keyCipher.decrypt(key.codeEncrypted),
        ])
      }

      await mailer.send({
        to: user.email,
        ...orderKeysEmail({
          displayName: user.displayName,
          order,
          keys,
          url: `${appUrl}/account/orders/${encodeURIComponent(order.number)}`,
        }),
      })
    } catch (error) {
      logger.error(
        { err: error, order: order.number },
        'Could not email the keys',
      )
    }
  }

  /**
   * Applies a result VNPay vouched for (by IPN or querydr) to its payment.
   * Every path is idempotent: the same result applied twice, or IPN and the
   * return applying it at once, ends in the same state.
   */
  async function settle(payment, params) {
    const providerDetails = providerDetailsFrom(params)

    if (!isSuccess(params)) {
      await orderRepository.markPaymentFailed({
        paymentId: payment._id,
        providerDetails,
      })
      return { outcome: 'failed' }
    }

    const result = await orderRepository.confirmOrderPayment({
      paymentId: payment._id,
      paidAt: parseVnpayDate(params.vnp_PayDate) ?? new Date(),
      providerDetails,
    })

    if (result.outcome === 'paid') {
      logger.info(
        { order: result.order.number, txnRef: payment.txnRef },
        'Order paid',
      )
      await afterPaid(result.order)
    }

    if (result.outcome === 'refund_required') {
      logger.warn(
        { txnRef: payment.txnRef, reason: result.payment?.refundReason },
        'Payment received but cannot be fulfilled; refund required',
      )
    }

    return result
  }

  return {
    isAvailable: () => Boolean(vnpay),

    /**
     * Starts paying for a pending order with VNPay: a new payment record and
     * the signed URL to send the shopper to. Its expiry is the order's, so
     * VNPay itself refuses a payment after the keys stop being held.
     */
    async createVnpayPayment(userId, rawNumber, { ipAddr }) {
      if (!vnpay) throw paymentUnavailable()

      const number = parseOrderNumber(rawNumber)
      const order = number
        ? await orderRepository.findUserOrderByNumber(userId, number)
        : null

      if (!order) throw new NotFoundError('Order not found.')

      if (order.status !== ORDER_STATUS.PENDING) {
        throw new ConflictError('This order can no longer be paid.', {
          code: ERROR_CODE.ORDER_NOT_PENDING,
          details: [{ field: 'status', status: order.status }],
        })
      }

      const now = new Date()

      if (order.expiresAt.getTime() - now.getTime() < MIN_PAYMENT_WINDOW_MS) {
        throw new ConflictError(
          'Too little time is left to pay for this order. Please check out again.',
          { code: ERROR_CODE.PAYMENT_WINDOW_CLOSED },
        )
      }

      const payment = await orderRepository.createPayment({
        orderId: order._id,
        userId,
        provider: PAYMENT_PROVIDER.VNPAY,
        txnRef: generateTxnRef(order.number),
        amount: order.total,
        expiresAt: order.expiresAt,
      })

      const url = vnpay.buildPaymentUrl({
        txnRef: payment.txnRef,
        amount: payment.amount,
        orderInfo: `Thanh toan don hang ${order.number}`,
        ipAddr,
        returnUrl: `${appUrl}/checkout/${encodeURIComponent(order.number)}/result`,
        createdAt: payment.createdAt,
        expiresAt: order.expiresAt,
      })

      return { data: { url, txnRef: payment.txnRef } }
    },

    /**
     * VNPay's server-to-server notification, the authoritative result.
     * Answers the `{ RspCode, Message }` body VNPay expects, never an error:
     * every outcome, including our own failures (99, retried by VNPay), is
     * reported in that body.
     */
    async handleVnpayIpn(query) {
      if (!vnpay) return IPN.UNKNOWN_ERROR

      try {
        const params = vnpay.verifyCallback(query)

        if (!params) {
          logger.warn(
            { txnRef: query?.vnp_TxnRef },
            'VNPay IPN with an invalid signature',
          )
          return IPN.INVALID_SIGNATURE
        }

        const payment = await orderRepository.findPaymentByTxnRef(
          params.vnp_TxnRef,
        )

        if (!payment) return IPN.NOT_FOUND

        if (Number(params.vnp_Amount) !== payment.amount * 100) {
          logger.warn(
            { txnRef: payment.txnRef, amount: params.vnp_Amount },
            'VNPay IPN amount does not match the payment',
          )
          return IPN.INVALID_AMOUNT
        }

        if (payment.status !== PAYMENT_STATUS.PENDING) {
          return IPN.ALREADY_CONFIRMED
        }

        const result = await settle(payment, params)

        return result.outcome === 'already_paid_by_this'
          ? IPN.ALREADY_CONFIRMED
          : IPN.CONFIRMED
      } catch (error) {
        logger.error({ err: error }, 'VNPay IPN failed')
        return IPN.UNKNOWN_ERROR
      }
    },

    /**
     * The shopper is back from VNPay. The redirect's parameters only say
     * which payment it was; the result is taken from VNPay itself (querydr)
     * unless the IPN has already settled it. Answers the order as it now is.
     */
    async handleVnpayReturn(userId, rawNumber, query, { ipAddr }) {
      if (!vnpay) throw paymentUnavailable()

      const params = vnpay.verifyCallback(query)
      const number = parseOrderNumber(rawNumber)

      if (!params || !number) {
        throw new BadRequestError(
          'This payment result could not be verified.',
          {
            code: ERROR_CODE.INVALID_PAYMENT_RESULT,
          },
        )
      }

      const payment = await orderRepository.findPaymentByTxnRef(
        params.vnp_TxnRef,
      )
      const order = payment
        ? await orderRepository.findOrderById(payment.orderId)
        : null

      if (
        !order ||
        String(order.userId) !== String(userId) ||
        order.number !== number
      ) {
        throw new BadRequestError(
          'This payment result could not be verified.',
          {
            code: ERROR_CODE.INVALID_PAYMENT_RESULT,
          },
        )
      }

      if (payment.status === PAYMENT_STATUS.PENDING) {
        try {
          const reply = await vnpay.queryTransaction({
            txnRef: payment.txnRef,
            transactionDate: payment.createdAt,
            orderInfo: `Kiem tra don hang ${order.number}`,
            ipAddr,
          })

          // `00` means the query itself worked; the payment's own result is
          // in `vnp_TransactionStatus`. A payment VNPay is still processing
          // (01) is left pending for the IPN.
          if (
            reply.vnp_ResponseCode === '00' &&
            reply.vnp_TxnRef === payment.txnRef &&
            Number(reply.vnp_Amount) === payment.amount * 100 &&
            reply.vnp_TransactionStatus !== '01'
          ) {
            await settle(payment, {
              ...reply,
              vnp_ResponseCode:
                reply.vnp_TransactionStatus === '00'
                  ? '00'
                  : reply.vnp_TransactionStatus,
            })
          }
        } catch (error) {
          // VNPay unreachable: the page asks again, and the IPN settles it.
          logger.warn(
            { err: error, txnRef: payment.txnRef },
            'VNPay querydr failed',
          )
        }
      }

      const current = await orderRepository.findPaymentByTxnRef(payment.txnRef)

      return {
        data: {
          orderNumber: order.number,
          payment: {
            status: current.status,
            responseCode: current.responseCode,
          },
        },
      }
    },

    // Where VNPay is told to send its IPN, for the README and the logs.
    ipnUrl: `${apiUrl}/api/v1/payments/vnpay/ipn`,
  }
}
