import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection, 
  subscriptionPlansCollection,
  cardIssuancesCollection,
  Membership
} from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { formatMagstripeData } from '@/lib/settings'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { subscriptionPlanId, paymentMethod } = body
    
    const existingMembership = await membershipsCollection.findById(id)
    
    if (!existingMembership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (!['ACTIVE', 'EXPIRED'].includes(existingMembership.status)) {
      return NextResponse.json(
        { error: 'Only active or expired memberships can be renewed' },
        { status: 400 }
      )
    }
    
    const [member, subscriptionPlan, membershipNumber] = await Promise.all([
      membersCollection.findById(existingMembership.memberId),
      subscriptionPlansCollection.findById(subscriptionPlanId),
      membershipNumbersCollection.findById(existingMembership.membershipNumberId),
    ])
    
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    if (!subscriptionPlan || !subscriptionPlan.isActive) {
      return NextResponse.json({ error: 'Subscription plan not found or inactive' }, { status: 404 })
    }
    
    if (!membershipNumber) {
      return NextResponse.json({ error: 'Membership number not found' }, { status: 404 })
    }
    
    const membershipData: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'> = {
      tenantId: existingMembership.tenantId,
      memberId: existingMembership.memberId,
      membershipNumberId: existingMembership.membershipNumberId,
      subscriptionPlanId,
      cardType: existingMembership.cardType,
      status: 'PENDING_PAYMENT',
      paymentMethod: paymentMethod || existingMembership.paymentMethod,
      paymentStatus: 'PENDING',
      tillSystemEnabled: false,
      accessToken: uuidv4(),
    }
    
    const newMembership = await membershipsCollection.create(membershipData)
    
    if (existingMembership.cardType === 'PHYSICAL_CARD') {
      const magstripeData = await formatMagstripeData(membershipNumber.cardNumber, existingMembership.tenantId)
      
      await cardIssuancesCollection.create({
        membershipId: newMembership.id,
        tenantId: existingMembership.tenantId,
        queueStatus: 'PENDING',
        magstripeData,
        notes: `Renewal of membership ${existingMembership.id}`
      })
    }
    
    const result = await membershipsCollection.findByIdWithRelations(newMembership.id)
    
    return NextResponse.json({
      ...result,
      previousMembershipId: existingMembership.id,
      paymentRequired: {
        amount: subscriptionPlan.price,
        currency: subscriptionPlan.currency,
        membershipId: newMembership.id
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error renewing membership:', error)
    return NextResponse.json({ error: 'Failed to renew membership' }, { status: 500 })
  }
}
