export type CardType = 'QR_CODE' | 'PHYSICAL_CARD' | 'BOTH'

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
