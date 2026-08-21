export const CARD_UNAVAILABLE_REASONS = [
  'not_found',
  'revoked',
  'expired',
  'pending',
  'physical',
] as const

export type CardUnavailableReason = (typeof CARD_UNAVAILABLE_REASONS)[number]

const COPY: Record<
  CardUnavailableReason,
  { title: string; body: string }
> = {
  not_found: {
    title: 'Card not found',
    body: 'We could not find this membership card. It may have been removed, or this link is not valid.',
  },
  revoked: {
    title: 'This card is no longer valid',
    body: 'This membership has been cancelled or revoked, so the card cannot be used.',
  },
  expired: {
    title: 'This membership has expired',
    body: 'This card is no longer in date. Ask at the bar if you need to renew.',
  },
  pending: {
    title: 'This card is not ready yet',
    body: 'This membership has not been issued, so it cannot be used at the bar yet.',
  },
  physical: {
    title: 'Show your physical card',
    body: 'This membership uses a physical card. Please present the card at the bar.',
  },
}

export function parseCardUnavailableReason(value: string | null | undefined): CardUnavailableReason {
  if (value && CARD_UNAVAILABLE_REASONS.includes(value as CardUnavailableReason)) {
    return value as CardUnavailableReason
  }
  return 'not_found'
}

export function cardUnavailableCopy(reason: CardUnavailableReason) {
  return COPY[reason]
}

export function cardUnavailableReasonFor(membership: { status: string } | null | undefined): CardUnavailableReason | null {
  if (!membership) return 'not_found'
  if (membership.status === 'CANCELLED') return 'revoked'
  if (membership.status === 'EXPIRED') return 'expired'
  if (membership.status === 'PENDING_PAYMENT') return 'pending'
  return null
}
