import { fieldError } from './query.validation.js'

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
// Whole dong, matching the storefront's price filter ceiling.
const PRICE_MAX = 100_000_000
const KEYS_PER_BATCH = 1000
const KEY_MIN_LENGTH = 5
const KEY_MAX_LENGTH = 100

export function text(value, field, { min = 0, max, required = false } = {}) {
  if (value === undefined && !required) return undefined

  if (typeof value !== 'string') {
    throw fieldError(field, `${field} must be text.`)
  }

  const trimmed = value.trim()

  if (trimmed.length < min || trimmed.length > max) {
    throw fieldError(
      field,
      min > 0
        ? `${field} must be ${min} to ${max} characters.`
        : `${field} must be at most ${max} characters.`,
    )
  }

  return trimmed
}

export function boolean(value, field) {
  if (value === undefined) return undefined

  if (typeof value !== 'boolean') {
    throw fieldError(field, `${field} must be true or false.`)
  }

  return value
}

function price(value, field, { nullable = false } = {}) {
  if (value === undefined) return undefined
  if (nullable && value === null) return null

  if (!Number.isInteger(value) || value < 0 || value > PRICE_MAX) {
    throw fieldError(
      field,
      `${field} must be a whole number of dong from 0 to ${PRICE_MAX}.`,
    )
  }

  return value
}

export function imageUrl(value, field) {
  const url = text(value, field, { min: 1, max: 2000, required: true })

  try {
    const parsed = new URL(url)

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('scheme')
    }
  } catch {
    throw fieldError(field, `${field} must be an http(s) URL.`)
  }

  return url
}

export function validateId(value, field = 'id') {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    throw fieldError(field, `${field} must be a valid identifier.`)
  }

  return value
}

/**
 * The fields of a product an admin may set. With `partial`, absent fields
 * are left as they are; otherwise the ones a product needs are required.
 */
export function validateProductBody(body = {}, { partial = false } = {}) {
  const required = !partial
  const product = {
    name: text(body.name, 'name', { min: 1, max: 120, required }),
    slug: text(body.slug, 'slug', { min: 1, max: 120, required }),
    shortDescription: text(body.shortDescription, 'shortDescription', {
      max: 300,
    }),
    description: text(body.description, 'description', { max: 10000 }),
    isPreorder: boolean(body.isPreorder, 'isPreorder'),
    published: boolean(body.published, 'published'),
  }

  if (product.slug !== undefined && !SLUG_PATTERN.test(product.slug)) {
    throw fieldError(
      'slug',
      'slug must be lowercase letters and digits joined by single hyphens.',
    )
  }

  if (body.releaseDate !== undefined || required) {
    if (
      typeof body.releaseDate !== 'string' ||
      !DATE_PATTERN.test(body.releaseDate) ||
      Number.isNaN(Date.parse(`${body.releaseDate}T00:00:00.000Z`))
    ) {
      throw fieldError('releaseDate', 'releaseDate must be a YYYY-MM-DD date.')
    }

    product.releaseDate = new Date(`${body.releaseDate}T00:00:00.000Z`)
  }

  if (body.imageUrl !== undefined || required) {
    product.image = {
      url: imageUrl(body.imageUrl, 'imageUrl'),
      // Covers are described by the game's name unless told otherwise.
      alt: text(body.imageAlt, 'imageAlt', { max: 200 }) || product.name,
    }
  }

  if (body.categoryIds !== undefined) {
    if (
      !Array.isArray(body.categoryIds) ||
      body.categoryIds.length > 20 ||
      !body.categoryIds.every(
        (id) => typeof id === 'string' && OBJECT_ID_PATTERN.test(id),
      )
    ) {
      throw fieldError(
        'categoryIds',
        'categoryIds must be a list of at most 20 category identifiers.',
      )
    }

    product.categoryIds = [...new Set(body.categoryIds)]
  }

  return Object.fromEntries(
    Object.entries(product).filter(([, value]) => value !== undefined),
  )
}

export function validateVariantBody(body = {}, { partial = false } = {}) {
  const required = !partial
  const variant = {
    edition: text(body.edition, 'edition', { min: 1, max: 60, required }),
    price: price(body.price, 'price'),
    originalPrice: price(body.originalPrice, 'originalPrice', {
      nullable: true,
    }),
  }

  if (required && variant.price === undefined) {
    throw fieldError('price', 'price is required.')
  }

  if (!partial || body.platformId !== undefined) {
    variant.platformId = validateId(body.platformId, 'platformId')
  }

  if (
    variant.originalPrice != null &&
    variant.price !== undefined &&
    variant.originalPrice <= variant.price
  ) {
    throw fieldError(
      'originalPrice',
      'originalPrice must be above price, or empty when there is no discount.',
    )
  }

  return Object.fromEntries(
    Object.entries(variant).filter(([, value]) => value !== undefined),
  )
}

/**
 * Codes pasted one per line (or comma separated). Blank lines are skipped and
 * repeats within the batch collapse; the stock check finds repeats of codes
 * already sold or held.
 */
export function validateKeysBody(body = {}) {
  const raw = body.codes

  if (typeof raw !== 'string' && !Array.isArray(raw)) {
    throw fieldError('codes', 'codes must be text, one code per line.')
  }

  const codes = (Array.isArray(raw) ? raw : raw.split(/[\r\n,]+/))
    .map((code) => (typeof code === 'string' ? code.trim() : ''))
    .filter(Boolean)

  if (codes.length === 0) {
    throw fieldError('codes', 'Add at least one code.')
  }

  const invalid = codes.find(
    (code) =>
      code.length < KEY_MIN_LENGTH ||
      code.length > KEY_MAX_LENGTH ||
      /\s/.test(code),
  )

  if (invalid !== undefined) {
    throw fieldError(
      'codes',
      `Each code must be ${KEY_MIN_LENGTH} to ${KEY_MAX_LENGTH} characters with no spaces.`,
    )
  }

  const unique = [...new Set(codes.map((code) => code.toUpperCase()))]

  if (unique.length > KEYS_PER_BATCH) {
    throw fieldError('codes', `Add at most ${KEYS_PER_BATCH} codes at a time.`)
  }

  return { codes: unique, repeated: codes.length - unique.length }
}

export function validateRefundBody(body = {}) {
  return { note: text(body.note, 'note', { max: 500 }) || null }
}
