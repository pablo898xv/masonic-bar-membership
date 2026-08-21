import { NextRequest, NextResponse } from 'next/server'
import { creditsErrorResponse } from '@/lib/tenancy'
import { reconcileByExternalId } from '@/lib/open-banking'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const paymentId =
      typeof body.paymentId === 'string'
        ? body.paymentId
        : typeof body.poId === 'string'
          ? body.poId
          : typeof body.po === 'string'
            ? body.po
            : ''

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 })
    }

    if (paymentId.startsWith('mock_')) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'Mock payments are completed through mock checkout, not this endpoint.',
      })
    }

    const result = await reconcileByExternalId(paymentId)
    if (!result.ok && result.error === 'Payment not found') {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Reconcile failed' }, { status: 502 })
    }

    return NextResponse.json({ received: true, status: result.status })
  } catch (error) {
    const credits = creditsErrorResponse(error)
    if (credits) return credits
    console.error('Error processing payment reconcile:', error)
    return NextResponse.json({ error: 'Payment reconcile failed' }, { status: 500 })
  }
}
