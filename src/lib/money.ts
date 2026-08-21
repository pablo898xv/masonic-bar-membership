export function formatGbp(amount: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
}

export function isZeroPrice(amount: number | undefined | null) {
  return !amount
}

export function formatPlanPrice(amount: number | undefined | null, currency = 'GBP') {
  if (isZeroPrice(amount)) return 'Free'
  return formatGbp(Number(amount), currency)
}

export function methodLabel(method: string) {
  if (method === 'COMPLIMENTARY') return 'Complimentary'
  if (method === 'OPEN_BANKING') return 'Open banking'
  if (method === 'CARD') return 'Card'
  if (method === 'CASH') return 'Cash'
  if (method === 'IN_PERSON') return 'In person'
  return method
}
