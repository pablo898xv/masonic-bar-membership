import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  paymentTransactionsCollection 
} from '@/lib/db'
import { pixlPay } from '@/lib/pixlpay'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const signature = request.headers.get('x-pixlpay-signature')
    
    if (!(await pixlPay.verifyWebhook(body, signature || ''))) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }
    
    const { paymentId, status, metadata } = body
    
    const membership = await membershipsCollection.findById(metadata?.membershipId)
    
    if (!membership) {
      console.error('Membership not found for payment:', paymentId)
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (status === 'completed' || status === 'success') {
      await fulfillPaidMembership(membership.id)
      await paymentTransactionsCollection.updateByExternalId(paymentId, {
        status: 'COMPLETED',
      })
      return NextResponse.json({ received: true })
    }

    if (status === 'failed' || status === 'declined') {
      await membershipsCollection.update(membership.id, { paymentStatus: 'FAILED' })
      await paymentTransactionsCollection.updateByExternalId(paymentId, { status: 'FAILED' })
    } else if (status === 'refunded') {
      await membershipsCollection.update(membership.id, {
        paymentStatus: 'REFUNDED',
        status: 'CANCELLED',
      })
      await paymentTransactionsCollection.updateByExternalId(paymentId, { status: 'REFUNDED' })
    } else if (status === 'processing') {
      await membershipsCollection.update(membership.id, { paymentStatus: 'PROCESSING' })
      await paymentTransactionsCollection.updateByExternalId(paymentId, { status: 'PROCESSING' })
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing payment webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
