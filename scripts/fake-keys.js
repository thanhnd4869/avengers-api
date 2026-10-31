import { randomInt } from 'node:crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * A made-up activation code shaped like a real one (`XXXXX-XXXXX-XXXXX`),
 * for development stock only. Never sell these.
 */
export function generateFakeCode() {
  const group = () =>
    Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
      '',
    )

  return `${group()}-${group()}-${group()}`
}

/** `count` fake codes, encrypted and fingerprinted with `keyCipher`. */
export function generateFakeKeys(count, keyCipher) {
  const codes = new Set()

  while (codes.size < count) codes.add(generateFakeCode())

  return [...codes].map((code) => ({
    codeEncrypted: keyCipher.encrypt(code),
    codeHash: keyCipher.hash(code),
  }))
}
