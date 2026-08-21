export type QrCodeMode = 'TILL' | 'URL' | 'SCRIPT'

export const QR_SCAN_SCRIPT_MAX = 100_000

export function qrCodeModeOf(value?: string | null): QrCodeMode {
  if (value === 'URL' || value === 'SCRIPT') return value
  return 'TILL'
}

export function qrUsesGateway(value?: string | null) {
  const mode = qrCodeModeOf(value)
  return mode === 'URL' || mode === 'SCRIPT'
}

export function qrScanScriptError(script: string) {
  if (script.length > QR_SCAN_SCRIPT_MAX) {
    return `Scan script is too long (max ${QR_SCAN_SCRIPT_MAX.toLocaleString()} characters).`
  }
  return null
}

export type QrScanMembership = {
  name: string
  email: string
  mobile: string
  phone: string
  cardNumber: number
  membershipId: string
  shortCode: string
  status: string
  planName: string
  expiryDate: string | null
  expiry: string
  tenant: string
  tenantSlug: string
}

export function qrRedirectUrlError(template: string) {
  const trimmed = template.trim()
  if (!trimmed) return 'Enter the web page the QR code should open.'
  const sample = fillQrRedirectUrl(trimmed, {
    cardNumber: '1500',
    membershipId: 'example',
    shortCode: 'abc12345',
    tenantSlug: 'venue',
  })
  try {
    const parsed = new URL(sample)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'The QR page must be an http or https address.'
    }
  } catch {
    return 'Enter a valid URL, for example https://example.com/join?ref={cardNumber}'
  }
  return null
}

function fillTemplate(template: string, vars: Record<string, string>) {
  let filled = template.trim()
  for (const [key, value] of Object.entries(vars)) {
    filled = filled.split(`{${key}}`).join(encodeURIComponent(value))
  }
  return filled
}

export function fillQrRedirectUrl(
  template: string,
  vars: {
    cardNumber: string | number
    membershipId?: string
    shortCode?: string
    tenantSlug?: string
  }
) {
  const cardNumber = String(vars.cardNumber)
  const filled = fillTemplate(template, {
    cardNumber,
    membershipNumber: cardNumber,
    membershipId: vars.membershipId || '',
    shortCode: vars.shortCode || '',
    tenant: vars.tenantSlug || '',
  })
  if (template.includes('{')) return filled
  try {
    const url = new URL(filled)
    url.searchParams.set('membershipNumber', cardNumber)
    return url.toString()
  } catch {
    return filled
  }
}

export function tillQrPayload(cardNumber: number, magstripePrefix?: string) {
  const prefix = (magstripePrefix || ';9998').trim()
  const payload = `${prefix}${cardNumber}`.trim().replace(/^[%;+]/, '').replace(/\?+$/, '')
  return `;${payload}?`
}

export function qrGatewayPath(input: {
  tenantSlug?: string
  cardNumber?: string | number
  shortCode?: string
}) {
  const slug = (input.tenantSlug || '').trim()
  const cardNumber =
    input.cardNumber != null && String(input.cardNumber).trim() !== '' ? String(input.cardNumber).trim() : ''
  const shortCode = (input.shortCode || '').trim()
  if (slug && cardNumber) return `/q/${encodeURIComponent(slug)}/${encodeURIComponent(cardNumber)}`
  if (slug && shortCode) return `/q/${encodeURIComponent(slug)}/${encodeURIComponent(shortCode)}`
  if (shortCode) return `/q/${encodeURIComponent(shortCode)}`
  return ''
}

export function buildMembershipQrPayload(input: {
  cardNumber: number
  magstripePrefix?: string
  qrCodeMode?: string
  qrRedirectUrl?: string
  membershipId?: string
  shortCode?: string
  tenantSlug?: string
  gatewayUrl?: string
}) {
  if (qrUsesGateway(input.qrCodeMode)) {
    if (input.gatewayUrl) return input.gatewayUrl
    return qrGatewayPath({
      tenantSlug: input.tenantSlug,
      cardNumber: input.cardNumber,
      shortCode: input.shortCode,
    })
  }
  return tillQrPayload(input.cardNumber, input.magstripePrefix)
}

export function isTillQrPayload(data: string) {
  return data.startsWith(';') && data.endsWith('?')
}
