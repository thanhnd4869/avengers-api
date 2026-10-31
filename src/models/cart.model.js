import mongoose from 'mongoose'

/**
 * A signed-in shopper's cart, one per account. Lines only point at variants;
 * names, prices and stock are read from the catalogue every time the cart is
 * shown, so a price change can never leave a stale total behind.
 */
const cartItemSchema = new mongoose.Schema(
  {
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: { type: [cartItemSchema], default: [] },
    // Bumped on every write, so two tabs changing the cart at once cannot
    // silently overwrite each other's change.
    revision: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'carts' },
)

export const Cart = mongoose.model('Cart', cartSchema)
