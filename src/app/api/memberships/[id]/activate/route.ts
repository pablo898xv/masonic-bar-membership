import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, subscriptionPlansCollection, cardIssuancesCollection } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const membership = await membershipsCollection.findById(id)
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (membership.status !== 'PAID') {
      return NextResponse.json(
        { error: 'Membership must be in PAID status to activate' },
        { status: 400 }
      )
    }
    
    const subscriptionPlan = await subscriptionPlansCollection.findById(membership.subscriptionPlanId)
    
    if (!subscriptionPlan) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 })
    }
    
    const now = new Date()
    const expiryDate = new Date(now)
    expiryDate.setFullYear(expiryDate.getFullYear() + subscriptionPlan.durationYears)
    
    const updatedMembership = await membershipsCollection.update(id, {
      status: 'ACTIVE',
      startDate: now,
      expiryDate,
    })
    
    if (membership.cardType === 'PHYSICAL_CARD') {
      const cardIssuance = await cardIssuancesCollection.findByMembershipId(id)
      
      if (cardIssuance) {
        await cardIssuancesCollection.update(cardIssuance.id, {
          queueStatus: 'READY_TO_ENCODE'
        })
      }
    }
    
    const result = await membershipsCollection.findByIdWithRelations(id)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error activating membership:', error)
    return NextResponse.json({ error: 'Failed to activate membership' }, { status: 500 })
  }
}
