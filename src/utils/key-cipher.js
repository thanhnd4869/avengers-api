import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'
const IV_BYTES = 12
// Binds each ciphertext to its purpose, so it cannot be passed off as some
// other encrypted value of the app.
const AAD = Buffer.from('avengers:product-key')

function deriveKey(master, purpose) {
  return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), purpose, 32))
}

function normalize(code) {
  return code.trim().toUpperCase()
}

/**
 * Encrypts game keys at rest. A database dump alone reveals no key: each one
 * is sealed with AES-256-GCM under a key that lives only in the environment.
 *
 * `hash` gives a stable fingerprint of a code, so the same key can never be
 * stocked twice, without storing it in the clear.
 *
 * Ciphertexts are `v1.<iv>.<tag>.<data>` in base64url; the version leaves room
 * to rotate the algorithm later.
 */
export function createKeyCipher(masterKey) {
  const encryptionKey = deriveKey(masterKey, 'product-key-encryption')
  const fingerprintKey = deriveKey(masterKey, 'product-key-fingerprint')

  return {
    encrypt(code) {
      const iv = randomBytes(IV_BYTES)
      const cipher = createCipheriv(ALGORITHM, encryptionKey, iv)

      cipher.setAAD(AAD)

      const data = Buffer.concat([
        cipher.update(normalize(code), 'utf8'),
        cipher.final(),
      ])

      return [VERSION, iv, cipher.getAuthTag(), data]
        .map((part) =>
          typeof part === 'string' ? part : part.toString('base64url'),
        )
        .join('.')
    },

    decrypt(payload) {
      const [version, iv, tag, data] = payload.split('.')

      if (version !== VERSION || !iv || !tag || !data) {
        throw new Error('Unrecognised product key ciphertext')
      }

      const decipher = createDecipheriv(
        ALGORITHM,
        encryptionKey,
        Buffer.from(iv, 'base64url'),
      )

      decipher.setAAD(AAD)
      decipher.setAuthTag(Buffer.from(tag, 'base64url'))

      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64url')),
        decipher.final(),
      ]).toString('utf8')
    },

    hash(code) {
      return createHmac('sha256', fingerprintKey)
        .update(normalize(code))
        .digest('hex')
    },
  }
}
