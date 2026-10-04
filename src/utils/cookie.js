/**
 * Reads one cookie from a `Cookie` header. Small enough not to warrant
 * `cookie-parser`, which would also parse every cookie on every request.
 */
export function readCookie(header, name) {
  if (typeof header !== 'string' || header === '') {
    return undefined
  }

  for (const pair of header.split(';')) {
    const index = pair.indexOf('=')

    if (index !== -1 && pair.slice(0, index).trim() === name) {
      const value = pair.slice(index + 1).trim()

      try {
        return decodeURIComponent(value)
      } catch {
        return undefined
      }
    }
  }

  return undefined
}
