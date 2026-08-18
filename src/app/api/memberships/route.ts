import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { membershipPurchaseSchema } from '@/lib/validation'
import { addYears } from 'date-fns'

const MAGSTRIPE_PREFIX = process.env.MAGSTRIPE_PREFIX || ';9998'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const cardType = searchParams.get('cardType')
    const memberId = searchParams.get('memberId')
    
    const skip = (page - 1) * limit
    
    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (cardType) where.cardType = cardType
    if (memberId) where.memberId = memberId
    
    const [memberships, total] = await Promise.all([
      prisma.membership.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          member: true,
          membershipNumber: true,
          subscriptionPlan: true,
          cardIssuance: true,
        }
      }),
      prisma.membership.count({ where })
    ])
    
    return NextResponse.json({
      memberships,
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
    
    const [member, plan, availableNumber] = await Promise.all([
      prisma.member.findUnique({ where: { id: memberId } }),
      prisma.subscriptionPlan.findUnique({ where: { id: subscriptionPlanId } }),
      prisma.membershipNumber.findFirst({
        where: { isAssigned: false },
        orderBy: { cardNumber: 'asc' }
      })
    ])
    
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Subscription plan not found or inactive' }, { status: 404 })
    }
    
    if (!availableNumber) {
      return NextResponse.json(
        { error: 'No available card numbers. Please import more numbers.' },
        { status: 400 }
      )
    }
    
    const membership = await prisma.$transaction(async (tx) => {
      await tx.membershipNumber.update({
        where: { id: availableNumber.id },
        data: {
          isAssigned: true,
          assignedAt: new Date()
        }
      })
      
      const newMembership = await tx.membership.create({
        data: {
          memberId,
          membershipNumberId: availableNumber.id,
          subscriptionPlanId,
          cardType,
          paymentMethod,
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING'
        },
        include: {
          member: true,
          membershipNumber: true,
          subscriptionPlan: true,
        }
      })
      
      if (cardType === 'PHYSICAL_CARD') {
        const magstripeData = `${MAGSTRIPE_PREFIX}${availableNumber.cardNumber}`
        
        await tx.cardIssuance.create({
          data: {
            membershipId: newMembership.id,
            magstripeData,
            queueStatus: 'PENDING'
          }
        })
      }
      
      return newMembership
    })
    
    const membershipWithIssuance = await prisma.membership.findUnique({
      where: { id: membership.id },
      include: {
        member: true,
        membershipNumber: true,
        subscriptionPlan: true,
        cardIssuance: true,
      }
    })
    
    return NextResponse.json({
      membership: membershipWithIssuance,
      payment: {
        amount: plan.price,
        currency: plan.currency,
        paymentMethod,
        redirectUrl: `/api/payments/initiate?membershipId=${membership.id}`
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating membership:', error)
    return NextResponse.json({ error: 'Failed to create membership' }, { status: 500 })
  }
}
