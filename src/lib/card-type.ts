export type CardType = 'QR_CODE' | 'PHYSICAL_CARD' | 'BOTH'

export type VenuePassTypes = {
  qr: boolean
  physical: boolean
  both: boolean
}

export const DEFAULT_PASS_TYPES: VenuePassTypes = {
  qr: true,
  physical: true,
  both: false,
}

export const PASS_TYPE_OPTIONS: Array<{
  value: CardType
  label: string
  hint: string
}> = [
  { value: 'QR_CODE', label: 'Digital QR only', hint: 'Instant issue to a phone' },
  { value: 'PHYSICAL_CARD', label: 'Physical card only', hint: 'Plastic card to collect at the bar' },
  { value: 'BOTH', label: 'QR and physical card', hint: 'Wallet pass plus a plastic card' },
]

export function cardTypeLabel(cardType: string) {
  if (cardType === 'QR_CODE') return 'QR Code'
  if (cardType === 'BOTH') return 'QR + Physical'
  return 'Physical card'
}

export function hasDigitalCard(cardType: string) {
  return cardType === 'QR_CODE' || cardType === 'BOTH'
}

export function hasPhysicalCard(cardType: string) {
  return cardType === 'PHYSICAL_CARD' || cardType === 'BOTH'
}

export function passTypesOf(value?: Partial<VenuePassTypes> | null): VenuePassTypes {
  const qr = value?.qr !== false
  const physical = value?.physical !== false
  const both = value?.both === true
  if (!qr && !physical && !both) return DEFAULT_PASS_TYPES
  return { qr, physical, both }
}

export function offeredCardTypes(passTypes: VenuePassTypes): CardType[] {
  return PASS_TYPE_OPTIONS.map((option) => option.value).filter((value) => {
    if (value === 'QR_CODE') return passTypes.qr
    if (value === 'PHYSICAL_CARD') return passTypes.physical
    return passTypes.both
  })
}

export function defaultCardType(passTypes: VenuePassTypes): CardType {
  return offeredCardTypes(passTypes)[0] || 'QR_CODE'
}

export function venueOffersCardType(passTypes: VenuePassTypes, cardType: string) {
  return offeredCardTypes(passTypes).includes(cardType as CardType)
}

export function venueAllowsFormat(passTypes: VenuePassTypes, format: 'QR_CODE' | 'PHYSICAL_CARD') {
  if (format === 'QR_CODE') return passTypes.qr || passTypes.both
  return passTypes.physical || passTypes.both
}

export function creditsNeeded(cardType: string) {
  return cardType === 'BOTH' ? 2 : 1
}

export function parsePassTypesBody(value: unknown): VenuePassTypes | { error: string } {
  if (!value || typeof value !== 'object') {
    return { error: 'Pass types are required.' }
  }
  const body = value as Record<string, unknown>
  const next: VenuePassTypes = {
    qr: Boolean(body.qr),
    physical: Boolean(body.physical),
    both: Boolean(body.both),
  }
  if (!next.qr && !next.physical && !next.both) {
    return { error: 'Turn on at least one pass type: QR only, physical only, or both.' }
  }
  return next
}
