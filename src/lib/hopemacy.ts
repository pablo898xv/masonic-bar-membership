import { getAppSettings } from './settings'
import { publicAppBaseUrl } from './public-url'
import { maskAccountNumber, maskSortCode } from './bank-account'

const DEFAULT_BASE_URL = 'https://pis.hopemacy.com/api/v1'
const DEFAULT_MAX_AMOUNT = 1000
export const HOPE_MACY_RETURN_PATH = '/api/payments/return'

export type HopeMacyStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'VOIDED'

export type CreditorAccount = {
  name: string
  sortCode: string
  accountNumber: string
}

export type OpenBankingInitiation = {
  amountGbp: number
  currency?: string
  reference: string
  description: string
  customerEmail?: string
  creditor: CreditorAccount
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, unknown>
}

type SessionCache = { token: string; expiresAt: number }

let sessionCache: SessionCache | null = null

function statementReference(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9&.\/-]+/g, '-').replace(/^-+|-+$/g, '')
  return (cleaned || 'credits').slice(0, 18)
}

function creditorId(value: string) {
  return value.replace(/[^A-Za-z0-9_.\/-]+/g, '').slice(0, 40)
}

function redirectUriForHopeMacy(returnUrl: string) {
  let origin: URL
  try {
    origin = new URL(publicAppBaseUrl())
  } catch {
    return null
  }
  const host = origin.hostname.toLowerCase()
  if (origin.protocol !== 'https:' || host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return null
  }

  // Open banking whitelist matching ignores query strings, so the path must stay
  // fixed. Identity goes in the query (same pattern as Pixl Pay /p/return?code=).
  const dest = new URL(HOPE_MACY_RETURN_PATH, origin.origin)
  try {
    const incoming = new URL(returnUrl, origin.origin)
    for (const key of ['membershipId', 'kind', 'paymentId']) {
      const value = incoming.searchParams.get(key)
      if (value) dest.searchParams.set(key, value)
    }
  } catch {
    // Keep the fixed path even if the inbound return URL is malformed.
  }
  return dest.toString()
}

export class HopeMacyApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly err: Record<string, unknown> | null = null
  ) {
    super(message)
    this.name = 'HopeMacyApiError'
  }

  apiCode() {
    const code = this.err?.code
    return typeof code === 'number' ? code : typeof code === 'string' && /^\d+$/.test(code) ? Number(code) : null
  }
}

function hopeMacyErrorDetail(json: Record<string, unknown>) {
  const err = json.err
  if (!err || typeof err !== 'object' || Array.isArray(err)) return { message: '', err: null as Record<string, unknown> | null }
  const envelope = err as Record<string, unknown>
  const code = envelope.code
  const parm = envelope.parm
  if (code === 3403 || (parm && typeof parm === 'object' && !Array.isArray(parm) && (parm as Record<string, unknown>).redirectUri === 3403)) {
    return {
      message: `Open banking rejected the return URL. Whitelist ${publicAppBaseUrl()}${HOPE_MACY_RETURN_PATH} on the open banking app (query parameters are ignored for matching).`,
      err: envelope,
    }
  }
  if (typeof code === 'number' || typeof code === 'string') {
    return { message: `error ${code}`, err: envelope }
  }
  if (parm && typeof parm === 'object') {
    return { message: `field errors ${JSON.stringify(parm)}`, err: envelope }
  }
  return { message: '', err: envelope }
}

async function settings() {
  const app = await getAppSettings()
  return {
    baseUrl: (app.hopeMacyBaseUrl || DEFAULT_BASE_URL).replace(/\/$/, ''),
    appId: app.hopeMacyAppId || '',
    appSecret: app.hopeMacyAppSecret || '',
    maxAmount: Number(app.hopeMacyMaxAmount) || DEFAULT_MAX_AMOUNT,
  }
}

export async function hopeMacyEnabled() {
  const { appId, appSecret } = await settings()
  return Boolean(appId && appSecret)
}

export function mockPaymentsAllowed() {
  if (process.env.ALLOW_MOCK_PAYMENTS === 'true') return true
  if (process.env.ALLOW_MOCK_PAYMENTS === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

function basicAuth(user: string, pass: string) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
}

async function createSession() {
  const { baseUrl, appId, appSecret } = await settings()
  const ttl = 3600
  const response = await fetch(`${baseUrl}/create-session`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: basicAuth(appId, appSecret),
    },
    body: JSON.stringify({ expiryPeriod: ttl }),
  })
  const json = (await response.json().catch(() => ({}))) as { data?: { sessToken?: string }; err?: unknown }
  const token = json.data?.sessToken || ''
  if (!response.ok || !token) {
    const detail = hopeMacyErrorDetail(json as Record<string, unknown>)
    throw new HopeMacyApiError(
      detail.message || 'Open banking create-session failed',
      response.status,
      detail.err
    )
  }
  sessionCache = { token, expiresAt: Date.now() + Math.max(ttl - 60, 30) * 1000 }
  return token
}

async function sessionToken() {
  if (sessionCache && sessionCache.expiresAt > Date.now()) return sessionCache.token
  return createSession()
}

async function send(method: string, path: string, body?: unknown, retried = false): Promise<Record<string, unknown>> {
  const { baseUrl, appId } = await settings()
  const token = await sessionToken()
  const response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: basicAuth(appId, token),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && !retried) {
    sessionCache = null
    return send(method, path, body, true)
  }

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const detail = hopeMacyErrorDetail(json)
    const suffix = detail.message && !detail.message.startsWith('Open banking rejected') ? ` (${detail.message})` : ''
    throw new HopeMacyApiError(
      detail.message.startsWith('Open banking rejected')
        ? detail.message
        : `Open banking ${method} ${path} failed with HTTP ${response.status}${suffix}`,
      response.status,
      detail.err
    )
  }
  return json
}

export function toLegacyPaymentStatus(status: HopeMacyStatus) {
  switch (status) {
    case 'COMPLETED':
      return 'completed'
    case 'PROCESSING':
      return 'processing'
    case 'FAILED':
    case 'VOIDED':
      return 'failed'
    default:
      return 'pending'
  }
}

export function isHopeMacyFailedRedirectHint(status?: string | null) {
  const hint = (status || '').trim().toLowerCase()
  return (
    hint === 'denied' ||
    hint === 'rejected' ||
    hint === 'cancelled' ||
    hint === 'canceled' ||
    hint === 'failed' ||
    hint === 'error' ||
    hint === 'expired' ||
    hint === 'acceptedrejected' ||
    hint === 'voided'
  )
}

export function normalizeHopeMacyStatus(poStatus: string): HopeMacyStatus {
  switch (poStatus) {
    case 'acceptedComplete':
      return 'COMPLETED'
    case 'acceptedInProgress':
      return 'PROCESSING'
    case 'acceptedRejected':
      return 'FAILED'
    case 'voided':
      return 'VOIDED'
    default:
      return 'PENDING'
  }
}

export async function getPaymentOrderStatus(poId: string): Promise<HopeMacyStatus> {
  const result = await send('GET', `/pos/${encodeURIComponent(poId)}`)
  const data = (result.data || {}) as { status?: string }
  return normalizeHopeMacyStatus(String(data.status || ''))
}

export async function voidPaymentOrder(poId: string) {
  try {
    await send('POST', `/pos/${encodeURIComponent(poId)}/void`)
  } catch (error) {
    console.warn('Open banking void skipped', error)
  }
}

function mockPayment(request: OpenBankingInitiation) {
  const mockPaymentId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  const checkout = new URLSearchParams({ paymentId: mockPaymentId })
  const meta = request.metadata || {}
  if (meta.kind === 'credit_pack') {
    checkout.set('kind', 'credits')
    checkout.set('tenantId', String(meta.tenantId || ''))
    checkout.set('packageKey', String(meta.packageKey || ''))
  } else {
    checkout.set('membershipId', request.reference)
  }
  if (request.successUrl) checkout.set('returnUrl', request.successUrl)

  return {
    success: true as const,
    paymentId: mockPaymentId,
    paymentUrl: `/api/payments/mock-checkout?${checkout.toString()}`,
    metadata: request.metadata,
  }
}

export async function initiateOpenBankingPayment(request: OpenBankingInitiation) {
  if (request.currency && request.currency.toUpperCase() !== 'GBP') {
    return { success: false as const, paymentId: '', paymentUrl: '', error: 'Only GBP payments are supported' }
  }

  const { maxAmount } = await settings()
  if (request.amountGbp > maxAmount) {
    return {
      success: false as const,
      paymentId: '',
      paymentUrl: '',
      error: `This payment exceeds the open banking maximum of £${maxAmount.toFixed(2)}.`,
    }
  }

  const sortCode = maskSortCode(request.creditor.sortCode)
  const accountNumber = maskAccountNumber(request.creditor.accountNumber)
  if (!(await hopeMacyEnabled()) || sortCode.length !== 6 || accountNumber.length !== 8) {
    if (!(await hopeMacyEnabled())) {
      if (mockPaymentsAllowed()) {
        console.warn('Open banking is not configured; using mock open banking checkout')
        return mockPayment(request)
      }
      return {
        success: false as const,
        paymentId: '',
        paymentUrl: '',
        error: 'Open banking is not configured. A super admin must add open banking credentials in Platform settings.',
      }
    }
    return {
      success: false as const,
      paymentId: '',
      paymentUrl: '',
      error: 'Recipient bank account is not configured (sort code and account number).',
    }
  }

  try {
    const payload: Record<string, unknown> = {
      amount: request.amountGbp,
      currency: 'GBP',
      creditorAccount: {
        scheme: 'sortCodeAccountNumber',
        id: `${sortCode}${accountNumber}`,
        name: request.creditor.name,
      },
      statementReference: statementReference(request.reference),
      paymentContext: 'goodsServiceArrears',
      creditorId: creditorId(request.reference),
    }
    const redirectUri = redirectUriForHopeMacy(request.successUrl)
    if (redirectUri) payload.redirectUri = redirectUri
    if (request.customerEmail) payload.debtorDetails = { emailAddress: request.customerEmail }

    const created = await send('POST', '/pos', payload)
    const data = (created.data || {}) as { poId?: string }
    const poId = data.poId || ''
    if (!poId) {
      return { success: false as const, paymentId: '', paymentUrl: '', error: 'Open banking did not return a payment order id' }
    }

    const link = await send('POST', `/pos/${encodeURIComponent(poId)}/link`)
    const linkData = (link.data || {}) as { paymentUrl?: string }
    const paymentUrl = linkData.paymentUrl || ''
    if (!paymentUrl) {
      return { success: false as const, paymentId: poId, paymentUrl: '', error: 'Open banking did not return a payment URL' }
    }

    return { success: true as const, paymentId: poId, paymentUrl, metadata: request.metadata }
  } catch (error) {
    console.error('Open banking API error:', error)
    return {
      success: false as const,
      paymentId: '',
      paymentUrl: '',
      error: error instanceof Error ? error.message : 'Failed to start open banking payment',
    }
  }
}
