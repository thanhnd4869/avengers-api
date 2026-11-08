import {
  boolean,
  DATE_PATTERN,
  imageUrl,
  SLUG_PATTERN,
  text,
  validateId,
} from './admin-catalogue.validation.js'
import { parseOptionalSearch } from './admin.validation.js'
import {
  fieldError,
  parseOptionalEnum,
  parsePagination,
} from './query.validation.js'

const SORT_ORDER_MAX = 10_000
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/

function withoutUndefined(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  )
}

function sortOrder(value) {
  if (value === undefined) return undefined

  if (!Number.isInteger(value) || value < 0 || value > SORT_ORDER_MAX) {
    throw fieldError(
      'sortOrder',
      `sortOrder must be a whole number from 0 to ${SORT_ORDER_MAX}.`,
    )
  }

  return value
}

function slug(value, { required }) {
  const parsed = text(value, 'slug', { min: 1, max: 120, required })

  if (parsed !== undefined && !SLUG_PATTERN.test(parsed)) {
    throw fieldError(
      'slug',
      'slug must be lowercase letters and digits joined by single hyphens.',
    )
  }

  return parsed
}

/** A cover the shop can show: the URL and, by default, the title as alt text. */
function image(body, { required, fallbackAlt }) {
  if (body.imageUrl === undefined && !required) return undefined

  return {
    url: imageUrl(body.imageUrl, 'imageUrl'),
    alt: text(body.imageAlt, 'imageAlt', { max: 200 }) || fallbackAlt,
  }
}

/**
 * Where a banner sends the shopper: a path inside the shop (`/products/x`)
 * or an http(s) URL. Empty clears it.
 */
function linkUrl(value) {
  if (value === undefined) return undefined
  if (value === null) return null

  const parsed = text(value, 'linkUrl', { max: 2000 })

  if (!parsed) return null
  if (/^\/(?!\/)\S*$/.test(parsed)) return parsed

  try {
    const url = new URL(parsed)

    if (url.protocol === 'https:' || url.protocol === 'http:') return parsed
  } catch {
    // Reported below.
  }

  throw fieldError(
    'linkUrl',
    'linkUrl must be a shop path starting with "/" or an http(s) URL.',
  )
}

function publishedAt(value, { required }) {
  if (value === undefined && !required) return undefined

  const valid =
    typeof value === 'string' &&
    (DATE_PATTERN.test(value) || ISO_DATE_TIME_PATTERN.test(value)) &&
    !Number.isNaN(Date.parse(value))

  if (!valid) {
    throw fieldError(
      'publishedAt',
      'publishedAt must be a YYYY-MM-DD date or an ISO date-time.',
    )
  }

  return new Date(DATE_PATTERN.test(value) ? `${value}T00:00:00.000Z` : value)
}

function optionalId(value, field) {
  return value === undefined ? undefined : validateId(value, field)
}

function publishedFilter(value) {
  const parsed = parseOptionalEnum(value, {
    field: 'published',
    allowed: ['true', 'false'],
  })

  return parsed === undefined ? undefined : parsed === 'true'
}

export function validateBannerBody(body = {}, { partial = false } = {}) {
  const required = !partial
  const banner = {
    title: text(body.title, 'title', { min: 1, max: 120, required }),
    excerpt: text(body.excerpt, 'excerpt', { min: 1, max: 300, required }),
    linkUrl: linkUrl(body.linkUrl),
    linkLabel:
      body.linkLabel === null
        ? null
        : text(body.linkLabel, 'linkLabel', { max: 40 }),
    sortOrder: sortOrder(body.sortOrder),
    published: boolean(body.published, 'published'),
  }

  if (banner.linkLabel === '') banner.linkLabel = null
  banner.image = image(body, { required, fallbackAlt: banner.title })

  return withoutUndefined(banner)
}

export function validatePostBody(body = {}, { partial = false } = {}) {
  const required = !partial
  const post = {
    title: text(body.title, 'title', { min: 1, max: 160, required }),
    slug: slug(body.slug, { required }),
    excerpt: text(body.excerpt, 'excerpt', { min: 1, max: 400, required }),
    content: text(body.content, 'content', { max: 50_000 }),
    publishedAt: publishedAt(body.publishedAt, { required }),
    published: boolean(body.published, 'published'),
  }

  if (required || body.categoryId !== undefined) {
    post.categoryId = validateId(body.categoryId, 'categoryId')
  }

  post.image = image(body, { required, fallbackAlt: post.title })

  return withoutUndefined(post)
}

export function validateAdminPostListQuery(query = {}) {
  return {
    ...parsePagination(query, { defaultLimit: 20 }),
    search: parseOptionalSearch(query.q),
    published: publishedFilter(query.published),
    categoryId: optionalId(query.categoryId, 'categoryId'),
  }
}

export function validateAdminCommentListQuery(query = {}) {
  return {
    ...parsePagination(query, { defaultLimit: 20 }),
    search: parseOptionalSearch(query.q),
    postId: optionalId(query.postId, 'postId'),
  }
}
