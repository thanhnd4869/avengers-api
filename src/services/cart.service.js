import { ERROR_CODE } from '#constants/error-code.js'
import { ORDER_CURRENCY } from '#constants/order.js'
import { ConflictError, NotFoundError } from '#errors/app-error.js'
import {
  CART_MAX_LINES,
  CART_MAX_QUANTITY,
  parseVariantId,
  validateAddItemBody,
  validateItemsBody,
  validateQuantityBody,
} from '#validations/cart.validation.js'

// Optimistic writes are retried this many times before giving up; only tabs
// editing the same cart in the same instant ever need more than one.
const SAVE_ATTEMPTS = 5

// Prices are whole dong, so totals are whole numbers too.
const roundMoney = (value) => Math.round(value)

function maxQuantityFor(variant) {
  return Math.min(CART_MAX_QUANTITY, Math.max(variant.availableKeys, 0))
}

function variantNotFound() {
  return new NotFoundError('This game is no longer sold.')
}

/** Why no more of a variant fits: the per-order cap, or the stock left. */
function limitMessage(maxQuantity) {
  return maxQuantity >= CART_MAX_QUANTITY
    ? `You can buy up to ${CART_MAX_QUANTITY} keys of this game per order.`
    : `Only ${maxQuantity} ${maxQuantity === 1 ? 'key is' : 'keys are'} left for this game.`
}

/**
 * Turns stored lines into what the cart shows: the catalogue's current name,
 * price and stock for each one. Lines whose variant can no longer be bought
 * are left out and their ids returned in `removed`.
 */
function priceItems(items, variants) {
  const byId = new Map(
    variants.map((variant) => [String(variant._id), variant]),
  )
  const lines = []
  const removed = []

  for (const item of items) {
    const variantId = String(item.variantId)
    const variant = byId.get(variantId)

    if (!variant) {
      removed.push(variantId)
      continue
    }

    const maxQuantity = maxQuantityFor(variant)
    let status = 'ok'

    if (maxQuantity === 0) status = 'sold_out'
    else if (item.quantity > maxQuantity) status = 'limited'

    lines.push({
      variantId,
      quantity: item.quantity,
      maxQuantity,
      status,
      product: {
        slug: variant.product.slug,
        name: variant.product.name,
        image: variant.product.image,
      },
      platform: variant.platform,
      edition: variant.edition,
      price: variant.price,
      originalPrice:
        variant.originalPrice > variant.price ? variant.originalPrice : null,
      currency: variant.currency,
      lineTotal: roundMoney(variant.price * item.quantity),
    })
  }

  // Sold-out lines stay visible so the shopper sees what happened, but only
  // what can actually be bought counts towards the total.
  const buyable = lines.filter((line) => line.status === 'ok')

  return {
    items: lines,
    removed,
    summary: {
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: roundMoney(
        buyable.reduce((sum, line) => sum + line.lineTotal, 0),
      ),
      currency: lines[0]?.currency ?? ORDER_CURRENCY,
      canCheckout: lines.length > 0 && buyable.length === lines.length,
    },
  }
}

export function createCartService({ cartRepository }) {
  async function variantsFor(items) {
    return items.length
      ? cartRepository.findPurchasableVariants(
          items.map((item) => String(item.variantId)),
        )
      : []
  }

  /**
   * Reads the cart, lets `change` compute the new lines from the current ones
   * and the catalogue, and writes them unless another request changed the
   * cart in between, in which case it starts over from the fresh cart.
   */
  async function updateCart(userId, change) {
    for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt += 1) {
      const cart = await cartRepository.findCart(userId)
      const items = await change(cart.items)

      if (await cartRepository.saveCart(userId, items, cart.revision)) {
        return priceItems(items, await variantsFor(items))
      }
    }

    throw new ConflictError(
      'Your cart was changed at the same time. Please try again.',
    )
  }

  async function readCart(userId) {
    const { items } = await cartRepository.findCart(userId)
    // Carts saved under an earlier, higher per-order cap are brought down
    // to the current one, once, and the shopper is told (`adjusted`).
    const capped = items.map((item) =>
      item.quantity > CART_MAX_QUANTITY
        ? { ...item, quantity: CART_MAX_QUANTITY }
        : item,
    )
    const adjusted = capped.some((item, index) => item !== items[index])
    const priced = priceItems(capped, await variantsFor(capped))

    // Lines for games that left the catalogue are dropped for good, so the
    // shopper is told once rather than on every visit.
    if (priced.removed.length || adjusted) {
      const removed = new Set(priced.removed)

      await updateCart(userId, (current) =>
        current
          .filter((item) => !removed.has(String(item.variantId)))
          .map((item) =>
            item.quantity > CART_MAX_QUANTITY
              ? { ...item, quantity: CART_MAX_QUANTITY }
              : item,
          ),
      )
    }

    return adjusted ? { ...priced, adjusted } : priced
  }

  return {
    async getCart(userId) {
      return { data: await readCart(userId) }
    },

    async addItem(userId, body) {
      const { variantId, quantity } = validateAddItemBody(body)

      const data = await updateCart(userId, async (items) => {
        const [variant] = await cartRepository.findPurchasableVariants([
          variantId,
        ])

        if (!variant) throw variantNotFound()

        const maxQuantity = maxQuantityFor(variant)

        if (maxQuantity === 0) {
          throw new ConflictError('This game is sold out on this platform.', {
            code: ERROR_CODE.OUT_OF_STOCK,
          })
        }

        const existing = items.find(
          (item) => String(item.variantId) === variantId,
        )

        if (!existing && items.length >= CART_MAX_LINES) {
          throw new ConflictError(
            `A cart holds at most ${CART_MAX_LINES} different games.`,
            { code: ERROR_CODE.CART_LIMIT },
          )
        }

        if (existing && existing.quantity >= maxQuantity) {
          throw new ConflictError(limitMessage(maxQuantity), {
            code: ERROR_CODE.CART_LIMIT,
          })
        }

        // Adding more than is left fills the line up to the limit instead
        // of refusing the whole request.
        if (existing) {
          return items.map((item) =>
            item === existing
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + quantity, maxQuantity),
                }
              : item,
          )
        }

        return [
          ...items,
          {
            variantId,
            quantity: Math.min(quantity, maxQuantity),
            addedAt: new Date(),
          },
        ]
      })

      return { data }
    },

    async setQuantity(userId, rawVariantId, body) {
      const variantId = parseVariantId(rawVariantId)
      const { quantity } = validateQuantityBody(body)

      const data = await updateCart(userId, async (items) => {
        if (!items.some((item) => String(item.variantId) === variantId)) {
          throw new NotFoundError('This game is not in your cart.')
        }

        const [variant] = await cartRepository.findPurchasableVariants([
          variantId,
        ])

        if (!variant) throw variantNotFound()

        const maxQuantity = maxQuantityFor(variant)

        if (quantity > maxQuantity) {
          throw new ConflictError(
            maxQuantity === 0
              ? 'This game is sold out on this platform.'
              : limitMessage(maxQuantity),
            {
              code:
                maxQuantity === 0
                  ? ERROR_CODE.OUT_OF_STOCK
                  : ERROR_CODE.CART_LIMIT,
              details: [{ field: 'quantity', maxQuantity }],
            },
          )
        }

        return items.map((item) =>
          String(item.variantId) === variantId ? { ...item, quantity } : item,
        )
      })

      return { data }
    },

    async removeItem(userId, rawVariantId) {
      const variantId = parseVariantId(rawVariantId)
      const data = await updateCart(userId, async (items) =>
        items.filter((item) => String(item.variantId) !== variantId),
      )

      return { data }
    },

    /** Drops the lines of games just bought, leaving the rest of the cart. */
    async removeVariants(userId, variantIds) {
      const bought = new Set(variantIds.map(String))

      await updateCart(userId, async (items) =>
        items.filter((item) => !bought.has(String(item.variantId))),
      )
    },

    async clearCart(userId) {
      return { data: await updateCart(userId, async () => []) }
    },

    /**
     * Adds a guest cart from the browser into the account's cart after
     * signing in. Quantities of a game in both are added together, up to the
     * limit; games that cannot be bought any more are skipped.
     */
    async mergeCart(userId, body) {
      const { items: guestItems } = validateItemsBody(body)

      const data = await updateCart(userId, async (items) => {
        const variants = await variantsFor(guestItems)
        const byId = new Map(
          variants.map((variant) => [String(variant._id), variant]),
        )
        const merged = items.map((item) => ({ ...item }))

        for (const guest of guestItems) {
          const variant = byId.get(guest.variantId)
          const maxQuantity = variant ? maxQuantityFor(variant) : 0

          if (maxQuantity === 0) continue

          const existing = merged.find(
            (item) => String(item.variantId) === guest.variantId,
          )

          // A stored line already above what is left keeps its quantity and
          // shows as limited, rather than being cut without a word.
          if (existing) {
            existing.quantity = Math.max(
              existing.quantity,
              Math.min(existing.quantity + guest.quantity, maxQuantity),
            )
          } else if (merged.length < CART_MAX_LINES) {
            merged.push({
              variantId: guest.variantId,
              quantity: Math.min(guest.quantity, maxQuantity),
              addedAt: new Date(),
            })
          }
        }

        return merged
      })

      return { data }
    },

    /** Prices a guest cart kept in the browser, without storing it. */
    async previewCart(body) {
      const { items } = validateItemsBody(body)

      return { data: priceItems(items, await variantsFor(items)) }
    },
  }
}
