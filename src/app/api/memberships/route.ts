import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection, 
  subscriptionPlansCollection,
  cardIssuancesCollection,
  Membership
} from '@/lib/db'
import { membershipPurchaseSchema } from '@/lib/validation'

const MAGSTRIPE_PREFIX = process.env.MAGSTRIPE_PREFIX || ';9998'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || undefined
    const cardType = searchParams.get('cardType') || undefined
    
    const { memberships, total } = await membershipsCollection.findMany({
      status,
      cardType,
      take: limit,
    })
    
    const membershipsWithDetails = await Promise.all(
      memberships.map(async (m) => {
        const [member, membershipNumber, subscriptionPlan, cardIssuance] = await Promise.all([
          membersCollection.findById(m.memberId),
          membershipNumbersCollection.findById(m.membershipNumberId),
          subscriptionPlansCollection.findById(m.subscriptionPlanId),
          cardIssuancesCollection.findByMembershipId(m.id),
        ])
        return { ...m, member, membershipNumber, subscriptionPlan, cardIssuance }
      })
    )
    
    return NextResponse.json({
      memberships: membershipsWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching memberships:', error)
    return NextResponse.json({ error: 'Failed to fetch memberships' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validation = membershipPurchaseSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const { memberId, subscriptionPlanId, cardType, paymentMethod } = validation.data
    
    const [member, subscriptionPlan] = await Promise.all([
      membersCollection.findById(memberId),
      subscriptionPlansCollection.findById(subscriptionPlanId),
    ])
    
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    if (!subscriptionPlan || !subscriptionPlan.isActive) {
      return NextResponse.json({ error: 'Subscription plan not found or inactive' }, { status: 404 })
    }
    
    const availableNumber = await membershipNumbersCollection.findFirstAvailable()
    
    if (!availableNumber) {
      return NextResponse.json(
        { error: 'No card numbers available. Please import more numbers.' },
        { status: 400 }
      )
    }
    
    await membershipNumbersCollection.update(availableNumber.id, {
      isAssigned: true,
      assignedAt: new Date()
    })
    
    const membershipData: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'> = {
      memberId,
      membershipNumberId: availableNumber.id,
      subscriptionPlanId,
      cardType: cardType as 'QR_CODE' | 'PHYSICAL_CARD',
      status: 'PENDING_PAYMENT',
      paymentMethod: paymentMethod as 'CARD' | 'OPEN_BANKING',
      paymentStatus: 'PENDING',
      tillSystemEnabled: false,
    }
    
    const membership = await membershipsCollection.create(membershipData)
    
    if (cardType === 'PHYSICAL_CARD') {
      const magstripeData = `${MAGSTRIPE_PREFIX}${availableNumber.cardNumber}`
      
      await cardIssuancesCollection.create({
        membershipId: membership.id,
        queueStatus: 'PENDING',
        magstripeData,
      })
    }
    
    const result = await membershipsCollection.findByIdWithRelations(membership.id)
    
    return NextResponse.json({
      ...result,
      paymentRequired: {
        amount: subscriptionPlan.price,
        currency: subscriptionPlan.currency,
        membershipId: membership.id
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating membership:', error)
    return NextResponse.json({ error: 'Failed to create membership' }, { status: 500 })
  }
}
