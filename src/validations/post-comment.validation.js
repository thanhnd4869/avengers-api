import mongoose from 'mongoose'
import { fieldError, parsePagination } from './query.validation.js'

export const COMMENT_MIN_LENGTH = 2
export const COMMENT_MAX_LENGTH = 2000

function parseBody(body = {}) {
  const text = typeof body.body === 'string' ? body.body.trim() : ''

  if (text.length < COMMENT_MIN_LENGTH || text.length > COMMENT_MAX_LENGTH) {
    throw fieldError(
      'body',
      `Your comment must be between ${COMMENT_MIN_LENGTH} and ${COMMENT_MAX_LENGTH} characters.`,
    )
  }

  return text
}

export function parseCommentId(value, field = 'commentId') {
  if (typeof value !== 'string' || !mongoose.isObjectIdOrHexString(value)) {
    throw fieldError(field, `${field} is not a valid id.`)
  }

  return new mongoose.Types.ObjectId(value)
}

export function validateCommentListQuery(query) {
  return parsePagination(query, { defaultLimit: 20, maximumLimit: 50 })
}

export function validateNewComment(body = {}) {
  const { parentId } = body

  return {
    body: parseBody(body),
    parentId:
      parentId === undefined || parentId === null
        ? null
        : parseCommentId(parentId, 'parentId'),
  }
}

export function validateCommentUpdate(body = {}) {
  return { body: parseBody(body) }
}
