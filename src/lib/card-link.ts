import { randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { membershipsCollection } from '@/lib/db'

const SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
const SHORT_CODE_LENGTH = 8

export function publicAppUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

export function membershipCardUrl(membershipId: string, accessToken: string) {
  return `${publicAppUrl()}/membership/card/${membershipId}?token=${encodeURIComponent(accessToken)}`
}

export function membershipCardShortUrl(shortCode: string) {
  return `${publicAppUrl()}/c/${encodeURIComponent(shortCode)}`
}

export function generateCardShortCode(length = SHORT_CODE_LENGTH) {
  const bytes = randomBytes(length)
  let code = ''
  for (const byte of bytes) {
    code += SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length]
  }
  return code
}

export async function allocateCardShortCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const shortCode = generateCardShortCode()
    const existing = await membershipsCollection.findByShortCode(shortCode)
    if (!existing) return shortCode
  }
  throw new Error('Could not allocate a card short code')
}

export async function ensureMembershipCardLink(membership: {
  id: string
  accessToken?: string
  shortCode?: string
}) {
  const patch: { accessToken?: string; shortCode?: string } = {}
  const accessToken = membership.accessToken || uuidv4()
  if (!membership.accessToken) patch.accessToken = accessToken
  const shortCode = membership.shortCode || (await allocateCardShortCode())
  if (!membership.shortCode) patch.shortCode = shortCode
  if (Object.keys(patch).length) {
    await membershipsCollection.update(membership.id, patch)
  }
  const token = patch.accessToken || membership.accessToken!
  const code = patch.shortCode || membership.shortCode!
  return {
    accessToken: token,
    shortCode: code,
    cardUrl: membershipCardUrl(membership.id, token),
    shortUrl: membershipCardShortUrl(code),
  }
}

export function phoneDigits(phone: string) {
  return phone.replace(/\D/g, '')
}

export function phonesMatch(a: string, b: string) {
  const left = phoneDigits(a)
  const right = phoneDigits(b)
  if (!left || !right) return false
  if (left === right) return true
  const shorter = left.length < right.length ? left : right
  const longer = left.length < right.length ? right : left
  return longer.endsWith(shorter) && shorter.length >= 10
}
