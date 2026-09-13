import { fieldError } from './query.validation.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX_LENGTH = 254
const MESSAGE_MIN_LENGTH = 10
const MESSAGE_MAX_LENGTH = 2000

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function validateContactMessageBody(body = {}) {
  const email = asTrimmedString(body.email)
  const message = asTrimmedString(body.message)

  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) {
    throw fieldError('email', 'Please enter a valid email address.')
  }

  if (
    message.length < MESSAGE_MIN_LENGTH ||
    message.length > MESSAGE_MAX_LENGTH
  ) {
    throw fieldError(
      'message',
      `Message must contain between ${MESSAGE_MIN_LENGTH} and ${MESSAGE_MAX_LENGTH} characters.`,
    )
  }

  return { email, message }
}
