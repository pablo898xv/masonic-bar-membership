import { NextRequest, NextResponse } from 'next/server'
import {
  membershipsCollection,
  membersCollection,
  subscriptionPlansCollection,
  paymentTransactionsCollection,
} from '@/lib/db'
import { initiateOpenBankingPayment } from '@/lib/hopemacy'
import { reconcileByExternalId, reconcileMembershipPayment } from '@/lib/open-banking'
import { belongsToTenant, publicTenantPath, requireTenant, creditorForTenant, assertCreditsAvailable, unchargedFormats } from '@/lib/tenancy'
import { canAccessMembership, membershipNotFound } from '@/lib/membership-access'

export async function POST(request: NextRequest) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const body = await request.json()
    const { membershipId, returnUrl } = body

    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }

    const membership = await membershipsCollection.findById(membershipId)

    if (!membership || !belongsToTenant(membership, tenant.id)) {
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

    const pendingFormats = await unchargedFormats(
      tenant.id,
      membership.id,
      membership.cardType,
      membership.membershipNumberId
    )
    const credits = await assertCreditsAvailable(tenant.id, pendingFormats.length)
    if (!credits.ok) {
      return NextResponse.json({ error: credits.error }, { status: credits.status })
    }

    const [member, subscriptionPlan] = await Promise.all([
      membersCollection.findById(membership.memberId),
      subscriptionPlansCollection.findById(membership.subscriptionPlanId),
    ])

    if (!member || !subscriptionPlan) {
      return NextResponse.json({ error: 'Related data not found' }, { status: 404 })
    }

    const origin = new URL(request.url).origin
    const cardToken = membership.accessToken || ''
    const successUrl =
      returnUrl ||
      `${origin}/membership/card/${membershipId}?token=${encodeURIComponent(cardToken)}&paid=1`

    const creditor = await creditorForTenant(tenant)
    const paymentResult = await initiateOpenBankingPayment({
      amountGbp: subscriptionPlan.price,
      currency: subscriptionPlan.currency,
      reference: membershipId,
      description: `Membership: ${subscriptionPlan.name} for ${member.name}`,
      customerEmail: member.email,
      creditor,
      successUrl: `${origin}/api/payments/return?membershipId=${encodeURIComponent(membershipId)}`,
      cancelUrl: `${origin}${publicTenantPath(tenant.slug, '/membership/register')}?cancelled=true`,
      metadata: {
        membershipId,
        memberId: member.id,
        planId: subscriptionPlan.id,
        tenantId: tenant.id,
        paymentSource: creditor.source,
        returnUrl: successUrl,
      },
    })

    if (!paymentResult.success || !paymentResult.paymentUrl) {
      return NextResponse.json(
        { error: (!paymentResult.success && paymentResult.error) || 'Could not start open banking payment' },
        { status: 502 }
      )
    }

    await paymentTransactionsCollection.create({
      tenantId: tenant.id,
      membershipId,
      amount: subscriptionPlan.price,
      currency: subscriptionPlan.currency,
      paymentMethod: 'OPEN_BANKING',
      provider: 'HOPE_MACY',
      externalId: paymentResult.paymentId,
      status: 'PENDING',
      metadata: paymentResult.metadata,
    })

    await membershipsCollection.update(membershipId, {
      paymentId: paymentResult.paymentId,
      paymentMethod: 'OPEN_BANKING',
      paymentStatus: 'PROCESSING',
    })

    return NextResponse.json({
      paymentId: paymentResult.paymentId,
      paymentUrl: paymentResult.paymentUrl,
      redirectUrl: paymentResult.paymentUrl,
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
    const paymentId = searchParams.get('paymentId') || searchParams.get('poId')

    if (paymentId) {
      const result = await reconcileByExternalId(paymentId)
      if (!result.ok && result.error === 'Payment not found') {
        return NextResponse.json({ error: result.error }, { status: 404 })
      }
      return NextResponse.json({
        paymentId,
        status: result.status.toLowerCase(),
      })
    }

    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }

    const membership = await membershipsCollection.findById(membershipId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    if (!canAccessMembership(request, membership)) {
      return membershipNotFound()
    }
    if (!membership.paymentId) {
      return NextResponse.json({ error: 'No payment initiated for this membership' }, { status: 404 })
    }

    const result = await reconcileMembershipPayment(membershipId)
    return NextResponse.json({
      membershipId,
      paymentId: membership.paymentId,
      status: result.status.toLowerCase(),
      paymentMethod: membership.paymentMethod || 'OPEN_BANKING',
    })
  } catch (error) {
    console.error('Error fetching payment status:', error)
    return NextResponse.json({ error: 'Failed to fetch payment status' }, { status: 500 })
  }
}
