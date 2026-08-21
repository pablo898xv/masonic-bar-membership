import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ISSUER = 'Membership Manager'

export function generateTotpSecret() {
  return encodeBase32(randomBytes(20))
}

export function totpOtpauthUrl(email: string, secret: string) {
  const label = encodeURIComponent(`${ISSUER}:${email}`)
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

export function verifyTotpCode(secret: string, code: string, window = 1) {
  const digits = (code || '').replace(/\D/g, '')
  if (digits.length !== 6) return false
  try {
    const key = decodeBase32(secret)
    const now = Math.floor(Date.now() / 1000 / 30)
    let matched = false
    for (let offset = -window; offset <= window; offset += 1) {
      if (timingSafeEqualString(hotp(key, now + offset), digits)) matched = true
    }
    return matched
  } catch {
    return false
  }
}

export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8)
    let raw = ''
    for (const byte of bytes) raw += BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length]
    return `${raw.slice(0, 4)}-${raw.slice(4)}`
  })
}

export function normalizeBackupCode(code: string) {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function hashBackupCode(code: string) {
  return createHmac('sha256', backupPepper()).update(normalizeBackupCode(code)).digest('hex')
}

export function consumeBackupCode(hashes: string[] | undefined, code: string) {
  const hashed = hashBackupCode(code)
  const list = hashes || []
  const index = list.findIndex((item) => timingSafeEqualString(item, hashed))
  if (index < 0) return null
  return list.filter((_, i) => i !== index)
}

function backupPepper() {
  return process.env.JWT_SECRET || 'fallback-secret-change-in-production'
}

function hotp(secret: Buffer, counter: number) {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac = createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(binary % 1_000_000).padStart(6, '0')
}

function encodeBase32(buffer: Buffer) {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31]
  return output
}

function decodeBase32(input: string) {
  const clean = (input || '').toUpperCase().replace(/=+$/g, '').replace(/[\s-]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const idx = BASE32.indexOf(char)
    if (idx < 0) throw new Error('Invalid authenticator secret')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function timingSafeEqualString(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
