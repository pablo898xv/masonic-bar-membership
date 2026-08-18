import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { pixlPay } from '@/lib/pixlpay'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipId } = body
    
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }
    
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        member: true,
        subscriptionPlan: true,
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (membership.paymentStatus === 'COMPLETED') {
      return NextResponse.json({ error: 'Payment already completed' }, { status: 400 })
    }
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    const paymentResponse = await pixlPay.initiatePayment({
      amount: membership.subscriptionPlan.price,
      currency: membership.subscriptionPlan.currency,
      paymentMethod: membership.paymentMethod as 'CARD' | 'OPEN_BANKING',
      reference: `MEMBERSHIP-${membership.id}`,
      description: `Masonic Hall Bar Membership - ${membership.subscriptionPlan.name}`,
      customerEmail: membership.member.email,
      customerName: membership.member.name,
      metadata: {
        membershipId: membership.id,
        memberId: membership.memberId,
        cardType: membership.cardType,
      },
      returnUrl: `${appUrl}/membership/payment-complete?membershipId=${membership.id}`,
      webhookUrl: `${appUrl}/api/payments/webhook`,
    })
    
    if (!paymentResponse.success) {
      return NextResponse.json({
        error: paymentResponse.error || 'Failed to initiate payment'
      }, { status: 500 })
    }
    
    await prisma.$transaction([
      prisma.membership.update({
        where: { id: membershipId },
        data: {
          paymentId: paymentResponse.transactionId,
          paymentStatus: 'PROCESSING',
        }
      }),
      prisma.paymentTransaction.create({
        data: {
          membershipId,
          amount: membership.subscriptionPlan.price,
          currency: membership.subscriptionPlan.currency,
          paymentMethod: membership.paymentMethod || 'CARD',
          provider: 'PIXL_PAY',
          externalId: paymentResponse.transactionId,
          status: 'PROCESSING',
          metadata: JSON.stringify({
            subscriptionPlanId: membership.subscriptionPlanId,
            cardType: membership.cardType,
          })
        }
      })
    ])
    
    return NextResponse.json({
      redirectUrl: paymentResponse.redirectUrl,
      transactionId: paymentResponse.transactionId,
    })
  } catch (error) {
    console.error('Error initiating payment:', error)
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const membershipId = searchParams.get('membershipId')
  
  if (!membershipId) {
    return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
  }
  
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: {
      member: true,
      subscriptionPlan: true,
    }
  })
  
  if (!membership) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }
  
  return NextResponse.json({
    membershipId: membership.id,
    amount: membership.subscriptionPlan.price,
    currency: membership.subscriptionPlan.currency,
    paymentMethod: membership.paymentMethod,
    status: membership.paymentStatus,
  })
}
