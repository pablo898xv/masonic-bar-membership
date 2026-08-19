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
    
    if (membership.paymentMethod === 'COMPLIMENTARY') {
      return NextResponse.json(
        { error: 'Complimentary memberships do not require payment' },
        { status: 400 }
      )
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
    
    const origin = new URL(request.url).origin
    const webhookUrl = `${origin}/api/payments/webhook`
    const cardToken = membership.accessToken || ''
    const successUrl = returnUrl || `${origin}/membership/card/${membershipId}?token=${encodeURIComponent(cardToken)}&paid=1`
    
    const chargedMethod = membership.paymentMethod === 'OPEN_BANKING' ? 'OPEN_BANKING' : 'CARD'

    const paymentResult = await pixlPay.initiatePayment({
      amount: subscriptionPlan.price,
      currency: subscriptionPlan.currency,
      paymentMethod: chargedMethod,
      reference: membershipId,
      description: `Membership: ${subscriptionPlan.name} for ${member.name}`,
      customerEmail: member.email,
      webhookUrl,
      successUrl,
      cancelUrl: `${origin}/membership/register?cancelled=true`,
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
      paymentMethod: chargedMethod,
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
      redirectUrl: paymentResult.paymentUrl,
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
