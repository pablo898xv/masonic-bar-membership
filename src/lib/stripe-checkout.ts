import { createHmac, timingSafeEqual } from 'crypto'
import { getAppSettings } from './settings'

const STRIPE_API = 'https://api.stripe.com/v1'

export type StripeCheckoutRequest = {
  secretKey: string
  amountGbp: number
  currency?: string
  description: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
  clientReferenceId?: string
}

export type StripeCheckoutResult =
  | { success: true; paymentId: string; paymentUrl: string }
  | { success: false; paymentId: ''; paymentUrl: ''; error: string }

type StripeSession = {
  id?: string
  url?: string
  status?: string
  payment_status?: string
  metadata?: Record<string, string>
}

function poundsToPence(amountGbp: number) {
  return Math.round(amountGbp * 100)
}

async function stripeForm(secretKey: string, path: string, method: 'GET' | 'POST', body?: Record<string, string>) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' && body ? new URLSearchParams(body).toString() : undefined,
  })
  const json = (await response.json().catch(() => ({}))) as {
    error?: { message?: string }
  } & StripeSession
  if (!response.ok) {
    throw new Error(json.error?.message || `Stripe request failed (${response.status})`)
  }
  return json
}

export async function createStripeCheckout(request: StripeCheckoutRequest): Promise<StripeCheckoutResult> {
  if (!request.secretKey) {
    return { success: false, paymentId: '', paymentUrl: '', error: 'Stripe is not configured.' }
  }

  const amount = poundsToPence(request.amountGbp)
  if (!Number.isFinite(amount) || amount < 30) {
    return { success: false, paymentId: '', paymentUrl: '', error: 'Stripe payments must be at least £0.30.' }
  }

  const body: Record<string, string> = {
    mode: 'payment',
    success_url: request.successUrl,
    cancel_url: request.cancelUrl,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': (request.currency || 'GBP').toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': request.description.slice(0, 120),
  }

  if (request.customerEmail) body.customer_email = request.customerEmail
  if (request.clientReferenceId) body.client_reference_id = request.clientReferenceId.slice(0, 200)

  for (const [key, value] of Object.entries(request.metadata)) {
    if (value) body[`metadata[${key}]`] = value.slice(0, 500)
  }

  try {
    const session = await stripeForm(request.secretKey, '/checkout/sessions', 'POST', body)
    if (!session.id || !session.url) {
      return { success: false, paymentId: '', paymentUrl: '', error: 'Stripe did not return a checkout URL.' }
    }
    return { success: true, paymentId: session.id, paymentUrl: session.url }
  } catch (error) {
    return {
      success: false,
      paymentId: '',
      paymentUrl: '',
      error: error instanceof Error ? error.message : 'Failed to start Stripe checkout',
    }
  }
}

export async function retrieveStripeSession(secretKey: string, sessionId: string): Promise<StripeSession> {
  return stripeForm(secretKey, `/checkout/sessions/${encodeURIComponent(sessionId)}`, 'GET')
}

export function stripeSessionPaid(session: StripeSession) {
  return session.payment_status === 'paid' || session.status === 'complete'
}

export function stripeSessionFailed(session: StripeSession) {
  return session.status === 'expired'
}

export function verifyStripeSignature(payload: string, header: string, secret: string, toleranceSec = 300) {
  const items = header.split(',').map((part) => part.trim())
  const timestamp = items.find((part) => part.startsWith('t='))?.slice(2)
  const signatures = items.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3))
  if (!timestamp || signatures.length === 0) {
    throw new Error('Invalid Stripe-Signature header')
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(Number(timestamp)) || age > toleranceSec) {
    throw new Error('Stripe signature timestamp is too old')
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const valid = signatures.some((signature) => {
    const actual = Buffer.from(signature, 'utf8')
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
  })
  if (!valid) throw new Error('Invalid Stripe signature')
}

export async function platformStripeSecret() {
  const settings = await getAppSettings()
  return settings.stripeSecretKey || ''
}

export async function platformStripeConfigured() {
  return Boolean(await platformStripeSecret())
}
