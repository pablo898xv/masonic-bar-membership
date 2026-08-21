export const CARD_PROCESSOR_IDS = ['stripe', 'worldpay', 'square', 'sumup', 'dojo'] as const

export type CardProcessorId = (typeof CARD_PROCESSOR_IDS)[number]

export type ProcessorField = {
  key: string
  label: string
  secret?: boolean
  placeholder?: string
  hint?: string
}

export type CardProcessorDefinition = {
  id: CardProcessorId
  name: string
  description: string
  liveCheckout: boolean
  fields: ProcessorField[]
}

export const CARD_PROCESSORS: CardProcessorDefinition[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Hosted Checkout for debit and credit cards. Live once a secret key is saved.',
    liveCheckout: true,
    fields: [
      { key: 'publishableKey', label: 'Publishable key', placeholder: 'pk_live_…' },
      { key: 'secretKey', label: 'Secret key', secret: true, placeholder: 'sk_live_…' },
      { key: 'webhookSecret', label: 'Webhook signing secret', secret: true, placeholder: 'whsec_…' },
    ],
  },
  {
    id: 'worldpay',
    name: 'Worldpay',
    description: 'Merchant credentials for Access / hosted payments. Checkout connector is stored ready to switch on.',
    liveCheckout: false,
    fields: [
      { key: 'merchantId', label: 'Merchant / installation ID' },
      { key: 'clientKey', label: 'Client key' },
      { key: 'serviceKey', label: 'Service key', secret: true },
    ],
  },
  {
    id: 'square',
    name: 'Square',
    description: 'Square Payments credentials for this venue. Checkout connector is stored ready to switch on.',
    liveCheckout: false,
    fields: [
      { key: 'applicationId', label: 'Application ID' },
      { key: 'locationId', label: 'Location ID' },
      { key: 'environment', label: 'Environment', placeholder: 'sandbox or production' },
      { key: 'accessToken', label: 'Access token', secret: true },
    ],
  },
  {
    id: 'sumup',
    name: 'SumUp',
    description: 'SumUp online checkout credentials for this venue. Checkout connector is stored ready to switch on.',
    liveCheckout: false,
    fields: [
      { key: 'merchantCode', label: 'Merchant code' },
      { key: 'apiKey', label: 'API key', secret: true },
    ],
  },
  {
    id: 'dojo',
    name: 'Dojo',
    description: 'Dojo Pay-By-Link / e-commerce credentials for this venue. Checkout connector is stored ready to switch on.',
    liveCheckout: false,
    fields: [
      { key: 'accountId', label: 'Account / organisation ID' },
      { key: 'apiKey', label: 'API key', secret: true },
    ],
  },
]

export type ProcessorConfig = {
  enabled?: boolean
} & Record<string, string | boolean | undefined>

export type TenantCardPayments = {
  defaultProvider?: CardProcessorId
} & Partial<Record<CardProcessorId, ProcessorConfig>>

export type AdminProcessorView = {
  id: CardProcessorId
  name: string
  description: string
  liveCheckout: boolean
  enabled: boolean
  configured: boolean
  live: boolean
  fields: Record<string, string>
  secretSet: Record<string, boolean>
}

function isProcessorId(value: unknown): value is CardProcessorId {
  return typeof value === 'string' && (CARD_PROCESSOR_IDS as readonly string[]).includes(value)
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function stringField(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function processorDefinition(id: CardProcessorId) {
  return CARD_PROCESSORS.find((item) => item.id === id)!
}

export function processorConfigured(id: CardProcessorId, config?: ProcessorConfig) {
  if (!config) return false
  if (id === 'stripe') return Boolean(stringField(config.secretKey))
  const secrets = processorDefinition(id).fields.filter((field) => field.secret)
  if (secrets.length === 0) return Boolean(config.enabled)
  return secrets.every((field) => Boolean(stringField(config[field.key])))
}

export function processorLive(id: CardProcessorId, config?: ProcessorConfig) {
  const def = processorDefinition(id)
  return Boolean(config?.enabled) && def.liveCheckout && processorConfigured(id, config)
}

export function liveCardProcessors(payments?: TenantCardPayments) {
  return CARD_PROCESSORS.filter((item) => processorLive(item.id, payments?.[item.id])).map((item) => ({
    id: item.id,
    name: item.name,
  }))
}

export function resolveLiveCardProcessor(
  payments: TenantCardPayments | undefined,
  requested?: string | null
): { id: CardProcessorId; name: string } | null {
  const live = liveCardProcessors(payments)
  if (live.length === 0) return null
  if (requested && isProcessorId(requested)) {
    const match = live.find((item) => item.id === requested)
    if (match) return match
  }
  const fallback = payments?.defaultProvider
  if (fallback) {
    const match = live.find((item) => item.id === fallback)
    if (match) return match
  }
  return live[0]
}

export function mergeCardPayments(
  current: TenantCardPayments | undefined,
  incoming: unknown
): TenantCardPayments {
  const next: TenantCardPayments = { ...(current || {}) }
  const patch = asObject(incoming)

  if (isProcessorId(patch.defaultProvider) || patch.defaultProvider === '') {
    next.defaultProvider = isProcessorId(patch.defaultProvider) ? patch.defaultProvider : undefined
  }

  for (const def of CARD_PROCESSORS) {
    if (!(def.id in patch)) continue
    const currentConfig = { ...(next[def.id] || {}) }
    const incomingConfig = asObject(patch[def.id])
    if (typeof incomingConfig.enabled === 'boolean') currentConfig.enabled = incomingConfig.enabled

    for (const field of def.fields) {
      if (!(field.key in incomingConfig)) continue
      const value = stringField(incomingConfig[field.key])
      if (field.secret && !value) continue
      currentConfig[field.key] = value
    }

    next[def.id] = currentConfig
  }

  if (!next.defaultProvider) {
    const firstEnabled = CARD_PROCESSORS.find((item) => next[item.id]?.enabled)
    if (firstEnabled) next.defaultProvider = firstEnabled.id
  }

  return next
}

export function serializeCardPayments(payments?: TenantCardPayments): AdminProcessorView[] {
  return CARD_PROCESSORS.map((def) => {
    const config = payments?.[def.id] || {}
    const fields: Record<string, string> = {}
    const secretSet: Record<string, boolean> = {}
    for (const field of def.fields) {
      const value = stringField(config[field.key])
      if (field.secret) {
        secretSet[field.key] = Boolean(value)
      } else {
        fields[field.key] = value
      }
    }
    const configured = processorConfigured(def.id, config)
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      liveCheckout: def.liveCheckout,
      enabled: Boolean(config.enabled),
      configured,
      live: processorLive(def.id, config),
      fields,
      secretSet,
    }
  })
}

export function stripeSecretFromPayments(payments?: TenantCardPayments) {
  return stringField(payments?.stripe?.secretKey)
}

export function stripeWebhookSecretFromPayments(payments?: TenantCardPayments) {
  return stringField(payments?.stripe?.webhookSecret)
}
