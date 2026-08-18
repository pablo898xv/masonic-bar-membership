import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  membersCollection, 
  subscriptionPlansCollection,
  paymentTransactionsCollection 
} from '@/lib/db'
import { pixlPay } from '@/lib/pixlpay'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipId, returnUrl } = body
    
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }
    
    const membership = await membershipsCollection.findById(membershipId)
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (membership.status !== 'PENDING_PAYMENT') {
      return NextResponse.json(
        { error: 'Payment already processed or membership not in pending state' },
        { status: 400 }
      )
    }
    
    const [member, subscriptionPlan] = await Promise.all([
      membersCollection.findById(membership.memberId),
      subscriptionPlansCollection.findById(membership.subscriptionPlanId),
    ])
    
    if (!member || !subscriptionPlan) {
      return NextResponse.json({ error: 'Related data not found' }, { status: 404 })
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const webhookUrl = `${baseUrl}/api/payments/webhook`
    const successUrl = returnUrl || `${baseUrl}/membership/payment-complete?membershipId=${membershipId}`
    
    const paymentResult = await pixlPay.initiatePayment({
      amount: subscriptionPlan.price,
      currency: subscriptionPlan.currency,
      paymentMethod: membership.paymentMethod || 'CARD',
      reference: membershipId,
      description: `Membership: ${subscriptionPlan.name} for ${member.name}`,
      customerEmail: member.email,
      webhookUrl,
      successUrl,
      cancelUrl: `${baseUrl}/membership/register?cancelled=true`,
      metadata: {
        membershipId,
        memberId: member.id,
        planId: subscriptionPlan.id,
      }
    })
    
    await paymentTransactionsCollection.create({
      membershipId,
      amount: subscriptionPlan.price,
      currency: subscriptionPlan.currency,
      paymentMethod: membership.paymentMethod || 'CARD',
      provider: 'PIXL_PAY',
      externalId: paymentResult.paymentId,
      status: 'PENDING',
      metadata: paymentResult.metadata
    })
    
    await membershipsCollection.update(membershipId, {
      paymentId: paymentResult.paymentId,
      paymentStatus: 'PROCESSING'
    })
    
    return NextResponse.json({
      paymentId: paymentResult.paymentId,
      paymentUrl: paymentResult.paymentUrl,
      expiresAt: paymentResult.expiresAt
    })
  } catch (error) {
    console.error('Error initiating payment:', error)
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const membershipId = searchParams.get('membershipId')
    
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }
    
    const membership = await membershipsCollection.findById(membershipId)
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (!membership.paymentId) {
      return NextResponse.json({ error: 'No payment initiated for this membership' }, { status: 404 })
    }
    
    const paymentStatus = await pixlPay.getPaymentStatus(membership.paymentId)
    
    if (!paymentStatus) {
      return NextResponse.json({ error: 'Could not retrieve payment status' }, { status: 500 })
    }
    
    return NextResponse.json({
      membershipId,
      paymentId: membership.paymentId,
      status: paymentStatus.status,
      paymentMethod: membership.paymentMethod
    })
  } catch (error) {
    console.error('Error fetching payment status:', error)
    return NextResponse.json({ error: 'Failed to fetch payment status' }, { status: 500 })
  }
}
