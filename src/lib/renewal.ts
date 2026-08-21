export const RENEWAL_OPENS_DAYS = 30

export function renewalReminderChannels(tenant?: {
  renewalEmailEnabled?: boolean
  renewalSmsEnabled?: boolean
} | null) {
  return {
    email: tenant?.renewalEmailEnabled !== false,
    sms: tenant?.renewalSmsEnabled !== false,
  }
}

export type RenewalMembership = {
  status: string
  expiryDate?: Date | string | null
}

export function isRenewalPayment(payment?: { metadata?: Record<string, unknown> } | null) {
  return payment?.metadata?.kind === 'RENEWAL'
}

export function addPlanYears(from: Date, durationYears: number) {
  const years = Math.max(1, Math.floor(Number(durationYears)) || 1)
  const next = new Date(from.getTime())
  next.setFullYear(next.getFullYear() + years)
  return next
}

export function asExpiryDate(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function renewedExpiryDate(
  currentExpiry: Date | string | null | undefined,
  durationYears: number,
  now = new Date()
) {
  const current = asExpiryDate(currentExpiry)
  const from = current || now
  const next = addPlanYears(from, durationYears)
  if (next.getTime() <= now.getTime()) return addPlanYears(now, durationYears)
  return next
}

export function renewalOpensAt(expiryDate: Date | string) {
  const expiry = asExpiryDate(expiryDate)
  if (!expiry) return null
  return new Date(expiry.getTime() - RENEWAL_OPENS_DAYS * 24 * 60 * 60 * 1000)
}

export function renewalWindowError(membership: RenewalMembership, now = new Date()) {
  if (membership.status !== 'ACTIVE' && membership.status !== 'EXPIRED') {
    return 'Only active or expired memberships can be renewed'
  }
  if (membership.status === 'EXPIRED') return null
  const expiry = asExpiryDate(membership.expiryDate)
  if (!expiry) return 'This membership has no expiry date to renew'
  const opensAt = renewalOpensAt(expiry)
  if (opensAt && now.getTime() < opensAt.getTime()) {
    return `Renewal opens 1 month before expiry (${opensAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}).`
  }
  return null
}

export function canRenewMembership(membership: RenewalMembership, now = new Date()) {
  return !renewalWindowError(membership, now)
}
