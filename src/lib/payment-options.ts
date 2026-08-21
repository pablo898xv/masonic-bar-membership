import { liveCardProcessors, resolveLiveCardProcessor, type CardProcessorId } from './card-processors'
import { hopeMacyEnabled, mockPaymentsAllowed } from './hopemacy'
import { platformStripeConfigured } from './stripe-checkout'
import type { Tenant } from './db'

export function venueOpenBankingEnabled(tenant: Pick<Tenant, 'openBankingEnabled'> | null | undefined) {
  return tenant?.openBankingEnabled !== false
}

export async function platformOpenBankingAvailable() {
  return (await hopeMacyEnabled()) || mockPaymentsAllowed()
}

export async function openBankingAvailable(tenant?: Pick<Tenant, 'openBankingEnabled'>) {
  if (tenant && !venueOpenBankingEnabled(tenant)) return false
  return platformOpenBankingAvailable()
}

export type PublicPaymentOptions = {
  openBanking: boolean
  card: { id: CardProcessorId; name: string }[]
  defaultMethod: 'CARD' | 'OPEN_BANKING'
  cardLabel: string
}

export function hasOnlineCheckout(options: PublicPaymentOptions) {
  return options.openBanking || options.card.length > 0
}

export function onlinePaymentMethodError(method: unknown, options: PublicPaymentOptions) {
  if (method === 'OPEN_BANKING' && !options.openBanking) {
    return 'Open banking is disabled for this venue. Enable it in Venue settings, or choose another payment method.'
  }
  if (method === 'CARD' && options.card.length === 0) {
    return 'Card payments are not live for this venue. Enable a card processor in Venue settings, or choose another payment method.'
  }
  return null
}

export async function publicPaymentOptions(tenant: Tenant): Promise<PublicPaymentOptions> {
  const openBanking = await openBankingAvailable(tenant)
  const card = liveCardProcessors(tenant.cardPayments)
  const resolved = resolveLiveCardProcessor(tenant.cardPayments)
  const defaultMethod: 'CARD' | 'OPEN_BANKING' =
    resolved && tenant.cardPayments?.defaultProvider === resolved.id
      ? 'CARD'
      : openBanking
        ? 'OPEN_BANKING'
        : card.length
          ? 'CARD'
          : 'OPEN_BANKING'

  return {
    openBanking,
    card,
    defaultMethod,
    cardLabel: resolved ? `Card (${resolved.name})` : 'Card',
  }
}

export function requestedPaymentMethod(value: unknown, options: PublicPaymentOptions): 'CARD' | 'OPEN_BANKING' {
  if (value === 'CARD' && options.card.length > 0) return 'CARD'
  if (value === 'OPEN_BANKING' && options.openBanking) return 'OPEN_BANKING'
  return options.defaultMethod
}

export async function creditPurchaseMethods() {
  const [card, openBanking] = await Promise.all([platformStripeConfigured(), platformOpenBankingAvailable()])
  return { card, openBanking }
}
