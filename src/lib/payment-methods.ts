export const MEMBERSHIP_PAYMENT_METHODS = [
  'CARD',
  'OPEN_BANKING',
  'CASH',
  'IN_PERSON',
  'COMPLIMENTARY',
] as const

export type MembershipPaymentMethod = (typeof MEMBERSHIP_PAYMENT_METHODS)[number]

export const ONLINE_PAYMENT_METHODS = ['CARD', 'OPEN_BANKING'] as const
export const MANUAL_PAYMENT_METHODS = ['CASH', 'IN_PERSON'] as const

export function isMembershipPaymentMethod(value: unknown): value is MembershipPaymentMethod {
  return typeof value === 'string' && (MEMBERSHIP_PAYMENT_METHODS as readonly string[]).includes(value)
}

export function isOnlinePaymentMethod(value: string | undefined) {
  return value === 'CARD' || value === 'OPEN_BANKING'
}

export function isManualPaymentMethod(value: string | undefined) {
  return value === 'CASH' || value === 'IN_PERSON'
}

export function isPaidMembershipStatus(status: string | undefined) {
  return status === 'ACTIVE' || status === 'PAID' || status === 'EXPIRED'
}

export const ADMIN_ONLY_ISSUE_MESSAGE =
  'Complimentary memberships can only be issued by the venue.'

export function paymentMethodLabel(method: string | undefined) {
  if (method === 'COMPLIMENTARY') return 'Complimentary'
  if (method === 'OPEN_BANKING') return 'Open banking'
  if (method === 'CARD') return 'Card'
  if (method === 'CASH') return 'Cash'
  if (method === 'IN_PERSON') return 'In person'
  return method || '—'
}

export function paymentProviderLabel(provider: string | undefined) {
  if (provider === 'STRIPE') return 'Stripe'
  if (provider === 'HOPE_MACY') return 'Open banking'
  if (provider === 'MANUAL') return 'Recorded at venue'
  if (provider === 'COMPLIMENTARY') return 'Complimentary'
  return provider || '—'
}

export function paymentProviderFor(method: MembershipPaymentMethod) {
  if (method === 'CARD') return 'STRIPE'
  if (method === 'OPEN_BANKING') return 'HOPE_MACY'
  if (method === 'COMPLIMENTARY') return 'COMPLIMENTARY'
  return 'MANUAL'
}
