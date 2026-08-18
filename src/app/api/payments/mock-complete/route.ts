import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  subscriptionPlansCollection,
  cardIssuancesCollection,
  paymentTransactionsCollection 
} from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipId, status } = body
    
    const membership = await membershipsCollection.findById(membershipId)
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    let paymentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' = 'PENDING'
    let membershipStatus = membership.status
    
    if (status === 'success') {
      paymentStatus = 'COMPLETED'
      membershipStatus = 'PAID'
      
      const subscriptionPlan = await subscriptionPlansCollection.findById(membership.subscriptionPlanId)
      
      if (subscriptionPlan) {
        const now = new Date()
        const expiryDate = new Date(now)
        expiryDate.setFullYear(expiryDate.getFullYear() + subscriptionPlan.durationYears)
        
        await membershipsCollection.update(membershipId, {
          status: 'ACTIVE',
          paymentStatus: 'COMPLETED',
          startDate: now,
          expiryDate
        })
        
        if (membership.cardType === 'PHYSICAL_CARD') {
          const cardIssuance = await cardIssuancesCollection.findByMembershipId(membershipId)
          
          if (cardIssuance) {
            await cardIssuancesCollection.update(cardIssuance.id, {
              queueStatus: 'READY_TO_ENCODE'
            })
          }
        }
      }
    } else {
      paymentStatus = 'FAILED'
      await membershipsCollection.update(membershipId, {
        paymentStatus: 'FAILED'
      })
    }
    
    if (membership.paymentId) {
      await paymentTransactionsCollection.updateByExternalId(membership.paymentId, {
        status: paymentStatus
      })
    }
    
    return NextResponse.json({ success: true, status: paymentStatus })
  } catch (error) {
    console.error('Error completing mock payment:', error)
    return NextResponse.json({ error: 'Failed to complete payment' }, { status: 500 })
  }
}
