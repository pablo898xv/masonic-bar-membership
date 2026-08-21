import { NextRequest, NextResponse } from 'next/server'
import { stripeWebhookSecretFromPayments } from '@/lib/card-processors'
import { tenantsCollection } from '@/lib/db'
import { reconcileByExternalId } from '@/lib/open-banking'
import { getAppSettings } from '@/lib/settings'
import { verifyStripeSignature } from '@/lib/stripe-checkout'

export async function handleStripeWebhook(request: NextRequest, tenantId?: string) {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature') || ''
  const secret = tenantId
    ? stripeWebhookSecretFromPayments((await tenantsCollection.findById(tenantId))?.cardPayments)
    : (await getAppSettings()).stripeWebhookSecret

  if (!secret) {
    return NextResponse.json({ error: 'Stripe webhook secret is not configured' }, { status: 400 })
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe-Signature header' }, { status: 400 })
  }

  try {
    verifyStripeSignature(payload, signature, secret)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid Stripe signature' },
      { status: 400 }
    )
  }

  const event = JSON.parse(payload) as { type?: string; data?: { object?: { id?: string } } }
  const sessionId = event.data?.object?.id || ''
  if (!sessionId) {
    return NextResponse.json({ received: true, ignored: true })
  }

  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded' &&
    event.type !== 'checkout.session.expired' &&
    event.type !== 'checkout.session.async_payment_failed'
  ) {
    return NextResponse.json({ received: true, ignored: true, type: event.type })
  }

  const result = await reconcileByExternalId(sessionId)
  if (!result.ok && result.error === 'Payment not found') {
    return NextResponse.json({ received: true, pending: true, error: result.error })
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Reconcile failed' }, { status: 502 })
  }

  return NextResponse.json({ received: true, status: result.status })
}
