import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

// N=2^15 costs ~32 MiB and tens of milliseconds per hash: slow enough to make
// guessing expensive, fast enough for a login request. `maxmem` must be raised
// because Node's default (32 MiB) is exactly what N=2^15, r=8 needs.
const PARAMS = Object.freeze({
  N: 2 ** 15,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
})
const KEY_LENGTH = 64
const SALT_LENGTH = 16

/**
 * Stored as `scrypt$N$r$p$salt$hash`, so the cost can be raised later without
 * invalidating existing passwords.
 */
export async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH)
  const key = await scryptAsync(password, salt, KEY_LENGTH, PARAMS)

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : []

  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false
  }

  const [, N, r, p, salt, hash] = parts
  const expected = Buffer.from(hash, 'base64url')
  const actual = await scryptAsync(
    password,
    Buffer.from(salt, 'base64url'),
    expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem },
  )

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Compared against when the email is unknown, so a miss costs as much time as
// a wrong password and response timing does not reveal registered addresses.
let dummyHash

export async function verifyAgainstDummy(password) {
  dummyHash ??= await hashPassword('dummy-password-for-timing')
  await verifyPassword(password, dummyHash)

  return false
}
