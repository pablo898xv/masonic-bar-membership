import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, subscriptionPlansCollection, paymentTransactionsCollection } from '@/lib/db'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipId, status } = body
    
    const membership = await membershipsCollection.findById(membershipId)
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (status === 'success') {
      await fulfillPaidMembership(membershipId)
      
      if (membership.paymentId) {
        await paymentTransactionsCollection.updateByExternalId(membership.paymentId, {
          status: 'COMPLETED',
        })
      }

      return NextResponse.json({ success: true, status: 'COMPLETED' })
    }

    await membershipsCollection.update(membershipId, {
      paymentStatus: 'FAILED',
    })

    if (membership.paymentId) {
      await paymentTransactionsCollection.updateByExternalId(membership.paymentId, {
        status: 'FAILED',
      })
    }

    return NextResponse.json({ success: true, status: 'FAILED' })
  } catch (error) {
    console.error('Error completing mock payment:', error)
    return NextResponse.json({ error: 'Failed to complete payment' }, { status: 500 })
  }
}
