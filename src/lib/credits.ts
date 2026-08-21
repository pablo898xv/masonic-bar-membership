export type CreditPackage = {
  key: string
  name: string
  credits: number
  pricePence: number
  sortOrder: number
  isActive: boolean
}

export type CreditGrant = {
  amount: number
  type: 'GRANT'
  note: string
  packageKey: string
  packageName: string
  pricePence: number
}

export const DEFAULT_CREDIT_PACKAGES: CreditPackage[] = [
  { key: 'starter', name: 'Starter', credits: 50, pricePence: 5000, sortOrder: 0, isActive: true },
  { key: 'pro', name: 'Pro', credits: 150, pricePence: 12000, sortOrder: 1, isActive: true },
  { key: 'growth', name: 'Growth', credits: 300, pricePence: 19500, sortOrder: 2, isActive: true },
  { key: 'scale', name: 'Scale', credits: 500, pricePence: 25000, sortOrder: 3, isActive: true },
]

export function activePackages(catalog: CreditPackage[] = DEFAULT_CREDIT_PACKAGES) {
  return catalog.filter((pack) => pack.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function findPackage(key: string, catalog: CreditPackage[] = DEFAULT_CREDIT_PACKAGES) {
  return activePackages(catalog).find((pack) => pack.key === key) || null
}

export function pencePerCredit(pack: CreditPackage) {
  if (pack.credits <= 0) return null
  return pack.pricePence / pack.credits
}

export function savingPercentVsBase(pack: CreditPackage, base?: CreditPackage | null) {
  const baseRate = base ? pencePerCredit(base) : null
  const rate = pencePerCredit(pack)
  if (!baseRate || !rate || pack.key === base?.key) return null
  return Math.max(0, Math.round((1 - rate / baseRate) * 100))
}

export function presentCatalog(catalog: CreditPackage[] = DEFAULT_CREDIT_PACKAGES) {
  const packs = activePackages(catalog)
  const base = packs[0] || null
  return packs.map((pack) => ({
    ...pack,
    pencePerCredit: pencePerCredit(pack),
    savingPercent: savingPercentVsBase(pack, base),
    priceLabel: `£${(pack.pricePence / 100).toFixed(2)}`,
  }))
}

export function grantPackage(key: string, catalog?: CreditPackage[]): CreditGrant | { error: string } {
  const pack = findPackage(key, catalog)
  if (!pack) return { error: 'Unknown credit pack' }
  return {
    amount: pack.credits,
    type: 'GRANT',
    note: `Credit pack: ${pack.name}`,
    packageKey: pack.key,
    packageName: pack.name,
    pricePence: pack.pricePence,
  }
}

export function packIsRevocable(entry: {
  type: string
  amount: number
  revoked?: boolean
  packageKey?: string
}) {
  return !entry.revoked && entry.amount > 0 && (entry.type === 'GRANT' || entry.type === 'TOPUP') && Boolean(entry.packageKey)
}

export const DEFAULT_SMS_CREDIT_COST = 0.25

export function roundCredits(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

export function formatCredits(amount: number) {
  const rounded = roundCredits(amount)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

export function parseSmsCreditCost(raw?: string) {
  const parsed = Number.parseFloat(raw || '')
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SMS_CREDIT_COST
  return roundCredits(parsed)
}
