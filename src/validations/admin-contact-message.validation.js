import { CONTACT_MESSAGE_STATUSES } from '@constants/contact-message.js'
import {
  fieldError,
  parseEnum,
  parseOptionalEnum,
  parsePagination,
} from './query.validation.js'

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i

export function validateContactMessageListQuery(query = {}) {
  return {
    ...parsePagination(query, { defaultLimit: 20 }),
    status: parseOptionalEnum(query.status, {
      field: 'status',
      allowed: CONTACT_MESSAGE_STATUSES,
    }),
  }
}

export function validateContactMessageId(id) {
  if (typeof id !== 'string' || !OBJECT_ID_PATTERN.test(id)) {
    throw fieldError('id', 'id must be a valid identifier.')
  }

  return id
}

export function validateContactMessageStatusBody(body = {}) {
  return {
    status: parseEnum(body.status, {
      field: 'status',
      fallback: undefined,
      allowed: CONTACT_MESSAGE_STATUSES,
    }),
  }
}
