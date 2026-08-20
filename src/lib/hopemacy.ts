import { getAppSettings } from './settings'

const DEFAULT_BASE_URL = 'https://pis.hopemacy.com/api/v1'
const DEFAULT_MAX_AMOUNT = 1000

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

function digits(value: string) {
  return value.replace(/\D/g, '')
}

function statementReference(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9&.\/-]+/g, '-').replace(/^-+|-+$/g, '')
  return (cleaned || 'credits').slice(0, 18)
}

function creditorId(value: string) {
  return value.replace(/[^A-Za-z0-9_.\/-]+/g, '').slice(0, 40)
}

function redirectUriForHopeMacy(returnUrl: string) {
  try {
    const parsed = new URL(returnUrl)
    const host = parsed.hostname.toLowerCase()
    if (parsed.protocol !== 'https:' || host === 'localhost' || host === '127.0.0.1') return null
    return parsed.toString()
  } catch {
    return null
  }
}

export class HopeMacyApiError extends Error {
  constructor(
    message: string,
    readonly status = 0
  ) {
    super(message)
    this.name = 'HopeMacyApiError'
  }
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
  const json = (await response.json().catch(() => ({}))) as { data?: { sessToken?: string } }
  const token = json.data?.sessToken || ''
  if (!response.ok || !token) {
    throw new HopeMacyApiError('Hope Macy create-session failed', response.status)
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
    throw new HopeMacyApiError(`Hope Macy ${method} ${path} failed with HTTP ${response.status}`, response.status)
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
    console.warn('Hope Macy void skipped', error)
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
      error: `This payment exceeds the Hope Macy maximum of £${maxAmount.toFixed(2)}.`,
    }
  }

  const sortCode = digits(request.creditor.sortCode)
  const accountNumber = digits(request.creditor.accountNumber)
  if (!(await hopeMacyEnabled()) || sortCode.length !== 6 || accountNumber.length !== 8) {
    if (!(await hopeMacyEnabled())) {
      console.warn('Hope Macy is not configured; using mock open banking checkout')
      return mockPayment(request)
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
      return { success: false as const, paymentId: '', paymentUrl: '', error: 'Hope Macy did not return a payment order id' }
    }

    const link = await send('POST', `/pos/${encodeURIComponent(poId)}/link`)
    const linkData = (link.data || {}) as { paymentUrl?: string }
    const paymentUrl = linkData.paymentUrl || ''
    if (!paymentUrl) {
      return { success: false as const, paymentId: poId, paymentUrl: '', error: 'Hope Macy did not return a payment URL' }
    }

    return { success: true as const, paymentId: poId, paymentUrl, metadata: request.metadata }
  } catch (error) {
    console.error('Hope Macy API error:', error)
    return {
      success: false as const,
      paymentId: '',
      paymentUrl: '',
      error: error instanceof Error ? error.message : 'Failed to start Hope Macy payment',
    }
  }
}
