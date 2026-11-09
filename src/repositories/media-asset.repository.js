import { Banner } from '#models/banner.model.js'
import { Gallery } from '#models/gallery.model.js'
import { Media } from '#models/media.model.js'
import { Order } from '#models/order.model.js'
import { Platform } from '#models/platform.model.js'
import { Post } from '#models/post.model.js'
import { Product } from '#models/product.model.js'

// Every place a stored file can be shown. Orders keep a copy of the product
// image, so a picture stays while any order still shows it.
const REFERENCES = [
  [Product, ['image.url', 'gallery.url']],
  [Banner, ['image.url']],
  [Post, ['image.url']],
  [Gallery, ['cover.url', 'images.url']],
  [Media, ['image.url', 'url']],
  [Platform, ['image.url']],
  [Order, ['items.image.url']],
]

/** Whether any document still points at a URL matching `pattern`. */
export async function isUrlReferenced(pattern) {
  const found = await Promise.all(
    REFERENCES.map(([model, paths]) =>
      model.exists({ $or: paths.map((path) => ({ [path]: pattern })) }),
    ),
  )

  return found.some(Boolean)
}
