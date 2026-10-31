import { randomInt } from 'node:crypto'
import { ERROR_CODE } from '#constants/error-code.js'
import {
  ORDER_CURRENCY,
  ORDER_STATUS,
  PAYMENT_STATUS,
} from '#constants/order.js'
import { ConflictError, NotFoundError } from '#errors/app-error.js'
import {
  parseOrderNumber,
  validateCreateOrderBody,
  validateOrderListQuery,
} from '#validations/order.validation.js'
import { toPaginatedResponse } from './pagination.js'

const SECOND = 1000
const MINUTE = 60 * SECOND
const ORDER_NUMBER_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const SWEEP_BATCH = 100

function orderNotFound() {
  return new NotFoundError('Order not found.')
}

/** `AV-YYMMDD-XXXXXX`: dated for support staff, random so it is unguessable. */
function generateOrderNumber(now = new Date()) {
  const date = now.toISOString().slice(2, 10).replaceAll('-', '')
  let suffix = ''

  for (let index = 0; index < 6; index += 1) {
    suffix += ORDER_NUMBER_ALPHABET[randomInt(ORDER_NUMBER_ALPHABET.length)]
  }

  return `AV-${date}-${suffix}`
}

/** What the shopper sees of an order. Internal ids stay inside the API. */
function toPublicOrder(order, { now = new Date(), keys } = {}) {
  const status = order.status

  return {
    number: order.number,
    status,
    items: order.items.map((item) => ({
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
      ...(keys && { keys: keys.get(String(item.variantId)) ?? [] }),
    })),
    itemCount: order.itemCount,
    total: order.total,
    currency: order.currency,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    // Lets the checkout page count down without trusting the device clock.
    // Rounded up, so a pending order never reports zero seconds left.
    secondsLeft:
      status === ORDER_STATUS.PENDING
        ? Math.max(Math.ceil((order.expiresAt - now) / SECOND), 1)
        : 0,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    expiredAt: order.expiredAt,
  }
}

export function createOrderService({
  orderRepository,
  cartRepository,
  cartService,
  keyCipher,
  holdMinutes,
  paymentGraceSeconds,
  logger,
}) {
  const holdMs = holdMinutes * MINUTE
  const graceMs = paymentGraceSeconds * SECOND

  /**
   * An order whose time is up but which no sweep has reached yet is closed on
   * the spot, so nobody ever sees a pending order past its deadline.
   */
  async function settleIfOverdue(order) {
    if (order.status !== ORDER_STATUS.PENDING || order.expiresAt > new Date()) {
      return order
    }

    const at = new Date()
    const closed = await orderRepository.closePendingOrder({
      orderId: order._id,
      status: ORDER_STATUS.EXPIRED,
      at,
      releaseAfter: new Date(at.getTime() + graceMs),
    })

    // Someone else closed or paid it in between; read what they left.
    return closed ?? (await orderRepository.findOrderById(order._id))
  }

  async function findOwnOrder(userId, rawNumber) {
    const number = parseOrderNumber(rawNumber)
    const order = number
      ? await orderRepository.findUserOrderByNumber(userId, number)
      : null

    if (!order) throw orderNotFound()

    return settleIfOverdue(order)
  }

  async function decryptKeys(order) {
    if (order.status !== ORDER_STATUS.PAID) return undefined

    const keys = new Map()

    for (const key of await orderRepository.findSoldKeys(order._id)) {
      const variantId = String(key.variantId)
      const codes = keys.get(variantId) ?? []

      codes.push(keyCipher.decrypt(key.codeEncrypted))
      keys.set(variantId, codes)
    }

    return keys
  }

  function pendingOrderExists(order) {
    return new ConflictError(
      'You already have an unpaid order. Pay for it or cancel it first.',
      {
        code: ERROR_CODE.PENDING_ORDER_EXISTS,
        details: [{ field: 'order', number: order.number }],
      },
    )
  }

  /**
   * Builds the order's lines from the cart as the catalogue prices it now,
   * refusing a cart that cannot be bought as it is or whose total is not the
   * one the shopper saw.
   */
  async function priceCheckout(userId, expectedTotal) {
    const { data: cart } = await cartService.getCart(userId)

    if (!cart.items.length) {
      throw new ConflictError('Your cart is empty.', {
        code: ERROR_CODE.CART_EMPTY,
      })
    }

    if (!cart.summary.canCheckout || cart.removed.length) {
      throw new ConflictError(
        'Some games in your cart cannot be bought as they are. Please review your cart.',
        { code: ERROR_CODE.CART_NOT_READY },
      )
    }

    if (cart.summary.subtotal !== expectedTotal) {
      throw new ConflictError(
        'Prices in your cart have changed. Please review your cart.',
        {
          code: ERROR_CODE.PRICE_CHANGED,
          details: [{ field: 'expectedTotal', total: cart.summary.subtotal }],
        },
      )
    }

    const variants = await cartRepository.findPurchasableVariants(
      cart.items.map((item) => item.variantId),
    )
    const byId = new Map(
      variants.map((variant) => [String(variant._id), variant]),
    )

    return {
      items: cart.items.map((line) => {
        const variant = byId.get(line.variantId)

        return {
          variantId: variant._id,
          productId: variant.product._id,
          productSlug: line.product.slug,
          productName: line.product.name,
          image: line.product.image,
          platform: line.platform,
          edition: line.edition,
          unitPrice: line.price,
          originalPrice: line.originalPrice,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
        }
      }),
      itemCount: cart.summary.itemCount,
      total: cart.summary.subtotal,
    }
  }

  return {
    /**
     * Turns the cart into a pending order and holds its keys for
     * `holdMinutes`. Safe against every race the checkout can meet:
     *
     * - the same request sent twice answers the same order (idempotency key);
     * - two tabs checking out at once: the database lets only one pending
     *   order per shopper exist, the other gets `PENDING_ORDER_EXISTS`;
     * - two shoppers buying the last key: the transaction in the repository
     *   holds a key only if it is still free, the loser gets `OUT_OF_STOCK`;
     * - prices changing under the shopper: `PRICE_CHANGED`, nothing is held.
     */
    async createOrder(userId, body) {
      const { idempotencyKey, expectedTotal } = validateCreateOrderBody(body)

      const repeated = await orderRepository.findUserOrderByIdempotencyKey(
        userId,
        idempotencyKey,
      )

      if (repeated) {
        return { data: toPublicOrder(await settleIfOverdue(repeated)) }
      }

      const pending = await orderRepository.findPendingUserOrder(userId)

      if (pending) {
        const current = await settleIfOverdue(pending)

        if (current.status === ORDER_STATUS.PENDING) {
          throw pendingOrderExists(current)
        }
      }

      const priced = await priceCheckout(userId, expectedTotal)
      const now = new Date()
      let order

      try {
        order = await orderRepository.createOrderWithReservation({
          number: generateOrderNumber(now),
          userId,
          status: ORDER_STATUS.PENDING,
          ...priced,
          currency: ORDER_CURRENCY,
          idempotencyKey,
          expiresAt: new Date(now.getTime() + holdMs),
        })
      } catch (error) {
        if (error instanceof orderRepository.OrderConflict) {
          if (error.reason === 'STOCK_MISMATCH') {
            logger.error(
              { variantId: error.details.variantId },
              'Variant key counter disagrees with its keys',
            )
          }

          throw new ConflictError(
            'Some games in your cart just sold out. Please review your cart.',
            { code: ERROR_CODE.OUT_OF_STOCK, details: [error.details] },
          )
        }

        if (orderRepository.isDuplicateKeyError(error, 'idempotencyKey')) {
          // The same request won a race against itself; answer its order.
          const winner = await orderRepository.findUserOrderByIdempotencyKey(
            userId,
            idempotencyKey,
          )

          return { data: toPublicOrder(winner) }
        }

        if (
          orderRepository.isDuplicateKeyError(
            error,
            'one_pending_order_per_user',
          )
        ) {
          throw pendingOrderExists(
            await orderRepository.findPendingUserOrder(userId),
          )
        }

        throw error
      }

      return { data: toPublicOrder(order, { now }) }
    },

    async getOrder(userId, number) {
      const order = await findOwnOrder(userId, number)
      const payments = await orderRepository.findOrderPayments(order._id)

      return {
        data: {
          ...toPublicOrder(order, { keys: await decryptKeys(order) }),
          // Shows a shopper who paid twice, or paid too late, that a refund
          // is on its way.
          refundPending: payments.some(
            (payment) => payment.status === PAYMENT_STATUS.REFUND_REQUIRED,
          ),
        },
      }
    },

    async getPendingOrder(userId) {
      const pending = await orderRepository.findPendingUserOrder(userId)
      const order = pending ? await settleIfOverdue(pending) : null

      return {
        data:
          order?.status === ORDER_STATUS.PENDING ? toPublicOrder(order) : null,
      }
    },

    async listOrders(userId, query) {
      const { page, limit } = validateOrderListQuery(query)
      const { orders, total } = await orderRepository.findUserOrders({
        userId,
        page,
        limit,
      })
      const settled = await Promise.all(orders.map(settleIfOverdue))

      return toPaginatedResponse(
        settled.map((order) => toPublicOrder(order)),
        { page, limit, total },
      )
    },

    async cancelOrder(userId, number) {
      const order = await findOwnOrder(userId, number)

      if (order.status !== ORDER_STATUS.PENDING) {
        throw new ConflictError('This order can no longer be cancelled.', {
          code: ERROR_CODE.ORDER_NOT_PENDING,
          details: [{ field: 'status', status: order.status }],
        })
      }

      const at = new Date()
      const cancelled = await orderRepository.closePendingOrder({
        orderId: order._id,
        userId,
        status: ORDER_STATUS.CANCELLED,
        at,
        releaseAfter: new Date(at.getTime() + graceMs),
      })

      if (!cancelled) {
        // Paid or expired a moment ago; report what actually happened.
        const current = await orderRepository.findOrderById(order._id)

        throw new ConflictError('This order can no longer be cancelled.', {
          code: ERROR_CODE.ORDER_NOT_PENDING,
          details: [{ field: 'status', status: current.status }],
        })
      }

      return { data: toPublicOrder(cancelled) }
    },

    /**
     * Expires overdue orders and puts held keys back on sale. Every step is a
     * conditional write, so several API instances may sweep at once.
     */
    async sweep(now = new Date()) {
      let expired = 0
      let released = 0

      for (const { _id } of await orderRepository.findOverduePendingOrderIds({
        now,
        limit: SWEEP_BATCH,
      })) {
        const closed = await orderRepository.closePendingOrder({
          orderId: _id,
          status: ORDER_STATUS.EXPIRED,
          at: now,
          releaseAfter: new Date(now.getTime() + graceMs),
        })

        if (closed) expired += 1
      }

      for (const { _id } of await orderRepository.findOrdersWithKeysToRelease({
        now,
        limit: SWEEP_BATCH,
      })) {
        released += await orderRepository.releaseHeldKeys(_id)
      }

      return { expired, released }
    },
  }
}
