import {
  boolean,
  imageUrl,
  SLUG_PATTERN,
  text,
} from './admin-catalogue.validation.js'
import { fieldError } from './query.validation.js'

const SORT_ORDER_MAX = 10_000
const PAGE_SLUGS = new Set(['faq', 'refund-policy', 'terms', 'privacy'])
const MEDIA_TYPES = new Set(['screenshot', 'video'])

function withoutUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  )
}

function sortOrder(value) {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || value < 0 || value > SORT_ORDER_MAX) {
    throw fieldError(
      'sortOrder',
      `sortOrder must be from 0 to ${SORT_ORDER_MAX}.`,
    )
  }
  return value
}

function slug(value, { required }) {
  const parsed = text(value, 'slug', { min: 1, max: 120, required })
  if (parsed !== undefined && !SLUG_PATTERN.test(parsed)) {
    throw fieldError(
      'slug',
      'Use lowercase letters, digits and single hyphens.',
    )
  }
  return parsed
}

function absoluteUrl(value, field) {
  const parsed = imageUrl(value, field)
  return parsed
}

function socialUrl(value) {
  const parsed = text(value, 'url', { min: 1, max: 2000, required: true })
  if (parsed === '#') return parsed
  return absoluteUrl(parsed, 'url')
}

function image(body, { required, fallbackAlt }) {
  if (body.imageUrl === undefined && !required) return undefined
  return {
    url: imageUrl(body.imageUrl, 'imageUrl'),
    alt:
      text(body.imageAlt, 'imageAlt', { max: 200 }) || fallbackAlt || 'Image',
  }
}

function validateSections(value, { required }) {
  if (value === undefined && !required) return undefined
  if (!Array.isArray(value) || value.length > 100) {
    throw fieldError(
      'sections',
      'sections must be a list of at most 100 entries.',
    )
  }
  return value.map((section, index) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      throw fieldError('sections', `Section ${index + 1} must be an object.`)
    }
    return {
      heading: text(section.heading, 'sections', {
        min: 1,
        max: 160,
        required: true,
      }),
      body: text(section.body, 'sections', {
        min: 1,
        max: 10_000,
        required: true,
      }),
    }
  })
}

export function validatePageSlug(value) {
  if (!PAGE_SLUGS.has(value)) {
    throw fieldError('slug', 'That page cannot be edited here.')
  }
  return value
}

export function validatePageBody(body = {}, { partial = false } = {}) {
  const required = !partial
  return withoutUndefined({
    title: text(body.title, 'title', { min: 1, max: 160, required }),
    summary: text(body.summary, 'summary', { max: 500 }),
    sections: validateSections(body.sections, { required }),
    published: boolean(body.published, 'published'),
  })
}

export function validatePlatformBody(body = {}, { partial = false } = {}) {
  const required = !partial
  const value = {
    name: text(body.name, 'name', { min: 1, max: 80, required }),
    slug: slug(body.slug, { required }),
    image: image(body, { required, fallbackAlt: body.name }),
    sortOrder: sortOrder(body.sortOrder),
    published: boolean(body.published, 'published'),
  }
  return withoutUndefined(value)
}

export function validateTaxonomyBody(body = {}, { partial = false } = {}) {
  const required = !partial
  return withoutUndefined({
    name: text(body.name, 'name', { min: 1, max: 80, required }),
    slug: slug(body.slug, { required }),
    sortOrder: sortOrder(body.sortOrder),
  })
}

export function validateGalleryBody(body = {}, { partial = false } = {}) {
  const required = !partial
  const value = {
    title: text(body.title, 'title', { min: 1, max: 160, required }),
    slug: slug(body.slug, { required }),
    sortOrder: sortOrder(body.sortOrder),
    published: boolean(body.published, 'published'),
  }
  if (body.coverUrl !== undefined || required) {
    value.cover = {
      url: imageUrl(body.coverUrl, 'coverUrl'),
      alt: text(body.coverAlt, 'coverAlt', { max: 200 }) || value.title,
    }
  }
  if (body.images !== undefined || required) {
    if (!Array.isArray(body.images) || body.images.length > 100) {
      throw fieldError(
        'images',
        'images must be a list of at most 100 entries.',
      )
    }
    value.images = body.images.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw fieldError('images', `Image ${index + 1} must be an object.`)
      }
      return {
        url: imageUrl(item.url, 'images'),
        alt: text(item.alt, 'images', { min: 1, max: 200, required: true }),
      }
    })
  }
  return withoutUndefined(value)
}

export function validateMediaBody(body = {}, { partial = false } = {}) {
  const required = !partial
  const value = {
    type: body.type === undefined && !required ? undefined : body.type,
    title: text(body.title, 'title', { max: 160 }),
    url:
      body.url === undefined && !required
        ? undefined
        : absoluteUrl(body.url, 'url'),
    sortOrder: sortOrder(body.sortOrder),
    published: boolean(body.published, 'published'),
  }
  if (value.type !== undefined && !MEDIA_TYPES.has(value.type)) {
    throw fieldError('type', 'type must be screenshot or video.')
  }
  if (required && value.type === undefined) {
    throw fieldError('type', 'type is required.')
  }
  value.image = image(body, { required, fallbackAlt: body.title || '' })
  return withoutUndefined(value)
}

export function validateSocialLinkBody(body = {}, { partial = false } = {}) {
  const required = !partial
  const network = text(body.network, 'network', { min: 1, max: 40, required })
  if (network !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(network)) {
    throw fieldError(
      'network',
      'network may contain letters, digits and hyphens.',
    )
  }
  return withoutUndefined({
    network: network?.toLowerCase(),
    label: text(body.label, 'label', { min: 1, max: 80, required }),
    url: body.url === undefined && !required ? undefined : socialUrl(body.url),
    sortOrder: sortOrder(body.sortOrder),
    published: boolean(body.published, 'published'),
  })
}
