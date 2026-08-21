import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'crypto'

export const MEMBER_PII_PREFIX = 'enc:v1:'
const DEV_PLACEHOLDER = 'local-dev-member-pii-key-not-for-production'
const HKDF_SALT = 'mbm-member-pii'
const INFO_ENC = 'mbm-member-pii-aes-v1'
const INFO_MAC = 'mbm-member-email-hmac-v1'

type PiiKeys = { enc: Buffer; mac: Buffer }

let cachedKeys: PiiKeys | null = null

function masterSecret() {
  const raw = (process.env.MEMBER_PII_KEY || '').trim()
  if (process.env.NODE_ENV === 'production' && (!raw || raw === DEV_PLACEHOLDER || raw.length < 32)) {
    throw new Error('MEMBER_PII_KEY must be set to a long random secret in production')
  }
  if (!raw) {
    throw new Error('MEMBER_PII_KEY must be set to encrypt member details')
  }
  return Buffer.from(raw, 'utf8')
}

function piiKeys(): PiiKeys {
  if (cachedKeys) return cachedKeys
  const master = masterSecret()
  cachedKeys = {
    enc: Buffer.from(hkdfSync('sha256', master, HKDF_SALT, INFO_ENC, 32)),
    mac: Buffer.from(hkdfSync('sha256', master, HKDF_SALT, INFO_MAC, 32)),
  }
  return cachedKeys
}

export function isEncryptedMemberField(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(MEMBER_PII_PREFIX)
}

export function normalizeMemberEmail(email: string) {
  return email.trim().toLowerCase()
}

export function canonicalMemberPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return ''
  return digits.slice(-10)
}

export function encryptMemberField(plaintext: string) {
  if (!plaintext) return plaintext
  if (isEncryptedMemberField(plaintext)) return plaintext
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', piiKeys().enc, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const packed = Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
  return MEMBER_PII_PREFIX + packed.toString('base64url')
}

export function decryptMemberField(value: string) {
  if (!isEncryptedMemberField(value)) return value
  try {
    const packed = Buffer.from(value.slice(MEMBER_PII_PREFIX.length), 'base64url')
    const iv = packed.subarray(0, 12)
    const tag = packed.subarray(12, 28)
    const ciphertext = packed.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', piiKeys().enc, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Could not decrypt member details. Check MEMBER_PII_KEY.')
  }
}

export function memberEmailHash(email: string) {
  return createHmac('sha256', piiKeys().mac).update(normalizeMemberEmail(email)).digest('base64url')
}

export function memberPhoneHash(phone: string) {
  const canonical = canonicalMemberPhone(phone)
  if (!canonical) return ''
  return createHmac('sha256', piiKeys().mac).update(`phone:${canonical}`).digest('base64url')
}

export function storedMemberNeedsSeal(data: {
  name?: unknown
  email?: unknown
  phone?: unknown
  emailHash?: unknown
  phoneHash?: unknown
}) {
  if (typeof data.emailHash !== 'string' || !data.emailHash) return true
  if (typeof data.phoneHash !== 'string' || !data.phoneHash) return true
  return ['name', 'email', 'phone'].some((key) => {
    const value = data[key as 'name' | 'email' | 'phone']
    return typeof value === 'string' && value.length > 0 && !isEncryptedMemberField(value)
  })
}

export function sealMemberFields(data: { name?: string; email?: string; phone?: string }) {
  const sealed: { name?: string; email?: string; phone?: string; emailHash?: string; phoneHash?: string } = {}
  if (typeof data.name === 'string') sealed.name = encryptMemberField(data.name.trim())
  if (typeof data.email === 'string') {
    const email = normalizeMemberEmail(data.email)
    sealed.email = encryptMemberField(email)
    sealed.emailHash = memberEmailHash(email)
  }
  if (typeof data.phone === 'string') {
    sealed.phone = encryptMemberField(data.phone.trim())
    const phoneHash = memberPhoneHash(data.phone)
    if (phoneHash) sealed.phoneHash = phoneHash
  }
  return sealed
}

export function unsealMemberFields<T extends {
  name?: string
  email?: string
  phone?: string
  emailHash?: string
  phoneHash?: string
}>(member: T): Omit<T, 'emailHash' | 'phoneHash'> {
  const { emailHash: _emailHash, phoneHash: _phoneHash, ...rest } = member
  return {
    ...rest,
    ...(typeof member.name === 'string' ? { name: decryptMemberField(member.name) } : {}),
    ...(typeof member.email === 'string' ? { email: decryptMemberField(member.email) } : {}),
    ...(typeof member.phone === 'string' ? { phone: decryptMemberField(member.phone) } : {}),
  }
}
