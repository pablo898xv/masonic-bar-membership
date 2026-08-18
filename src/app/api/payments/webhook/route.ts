import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  subscriptionPlansCollection,
  cardIssuancesCollection,
  paymentTransactionsCollection 
} from '@/lib/db'
import { pixlPay } from '@/lib/pixlpay'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const signature = request.headers.get('x-pixlpay-signature')
    
    if (!pixlPay.verifyWebhook(body, signature || '')) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }
    
    const { paymentId, status, metadata } = body
    
    const membership = await membershipsCollection.findById(metadata?.membershipId)
    
    if (!membership) {
      console.error('Membership not found for payment:', paymentId)
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    let paymentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' = 'PENDING'
    let membershipStatus = membership.status
    
    switch (status) {
      case 'completed':
      case 'success':
        paymentStatus = 'COMPLETED'
        membershipStatus = 'PAID'
        break
      case 'failed':
      case 'declined':
        paymentStatus = 'FAILED'
        break
      case 'refunded':
        paymentStatus = 'REFUNDED'
        membershipStatus = 'CANCELLED'
        break
      case 'processing':
        paymentStatus = 'PROCESSING'
        break
    }
    
    await membershipsCollection.update(membership.id, {
      paymentStatus,
      status: membershipStatus as 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
    })
    
    await paymentTransactionsCollection.updateByExternalId(paymentId, {
      status: paymentStatus
    })
    
    if (paymentStatus === 'COMPLETED' && membershipStatus === 'PAID') {
      const subscriptionPlan = await subscriptionPlansCollection.findById(membership.subscriptionPlanId)
      
      if (subscriptionPlan) {
        const now = new Date()
        const expiryDate = new Date(now)
        expiryDate.setFullYear(expiryDate.getFullYear() + subscriptionPlan.durationYears)
        
        await membershipsCollection.update(membership.id, {
          status: 'ACTIVE',
          startDate: now,
          expiryDate
        })
        
        if (membership.cardType === 'PHYSICAL_CARD') {
          const cardIssuance = await cardIssuancesCollection.findByMembershipId(membership.id)
          
          if (cardIssuance) {
            await cardIssuancesCollection.update(cardIssuance.id, {
              queueStatus: 'READY_TO_ENCODE'
            })
          }
        }
      }
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing payment webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
