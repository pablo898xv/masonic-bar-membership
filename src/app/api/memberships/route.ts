import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection, 
  subscriptionPlansCollection,
  cardIssuancesCollection,
  paymentTransactionsCollection,
  Membership
} from '@/lib/db'
import { membershipPurchaseSchema } from '@/lib/validation'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'
import { formatMagstripeData } from '@/lib/settings'
import { v4 as uuidv4 } from 'uuid'

async function nextCardNumber() {
  const existing = await membershipNumbersCollection.findFirstAvailable()
  if (existing) return existing

  const local = process.env.FIRESTORE_EMULATOR_HOST || process.env.USE_LOCAL_DB === 'true'
  if (!local) return null

  await membershipNumbersCollection.createMany(
    Array.from({ length: 200 }, (_, index) => ({
      cardNumber: 1500 + index,
      batchId: 'local-seed',
    }))
  )
  return membershipNumbersCollection.findFirstAvailable()
}

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
    
    const { memberId, subscriptionPlanId, cardType, paymentMethod, adminIssued } = validation.data

    if (paymentMethod === 'COMPLIMENTARY' && adminIssued !== true) {
      return NextResponse.json(
        { error: 'Complimentary memberships can only be issued by an admin' },
        { status: 403 }
      )
    }
    
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
    
    const availableNumber = await nextCardNumber()
    
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
    
    const isComplimentary = paymentMethod === 'COMPLIMENTARY'
    const membershipData: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'> = {
      memberId,
      membershipNumberId: availableNumber.id,
      subscriptionPlanId,
      cardType: cardType as 'QR_CODE' | 'PHYSICAL_CARD',
      status: isComplimentary ? 'PAID' : 'PENDING_PAYMENT',
      paymentMethod,
      paymentStatus: isComplimentary ? 'COMPLETED' : 'PENDING',
      tillSystemEnabled: false,
      accessToken: uuidv4(),
    }
    
    const membership = await membershipsCollection.create(membershipData)
    
    if (cardType === 'PHYSICAL_CARD') {
      const magstripeData = await formatMagstripeData(availableNumber.cardNumber)
      
      await cardIssuancesCollection.create({
        membershipId: membership.id,
        queueStatus: isComplimentary ? 'READY_TO_ENCODE' : 'PENDING',
        magstripeData,
      })
    }

    if (isComplimentary) {
      await paymentTransactionsCollection.create({
        membershipId: membership.id,
        amount: 0,
        currency: subscriptionPlan.currency,
        paymentMethod: 'COMPLIMENTARY',
        provider: 'COMPLIMENTARY',
        status: 'COMPLETED',
        metadata: { issuedBy: 'admin', reason: 'complimentary' },
      })

      await fulfillPaidMembership(membership.id)

      const result = await membershipsCollection.findByIdWithRelations(membership.id)
      return NextResponse.json({
        ...result,
        complimentary: true,
        paymentRequired: null,
      }, { status: 201 })
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
