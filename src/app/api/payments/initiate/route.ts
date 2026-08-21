import { NextRequest, NextResponse } from 'next/server'
import {
  membershipsCollection,
  membersCollection,
  subscriptionPlansCollection,
  paymentTransactionsCollection,
} from '@/lib/db'
import { initiateOpenBankingPayment } from '@/lib/hopemacy'
import { reconcileByExternalId, reconcileMembershipPayment } from '@/lib/open-banking'
import { resolveLiveCardProcessor, stripeSecretFromPayments } from '@/lib/card-processors'
import { hasOnlineCheckout, onlinePaymentMethodError, publicPaymentOptions } from '@/lib/payment-options'
import { createStripeCheckout } from '@/lib/stripe-checkout'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'
import { belongsToTenant, requireTenant, creditorForTenant, assertCreditsAvailable, unchargedFormats } from '@/lib/tenancy'
import { canAccessMembership, membershipNotFound } from '@/lib/membership-access'
import { ensurePendingMembershipPayment, latestOpenMembershipPayment } from '@/lib/membership-payment'
import { isManualPaymentMethod, isOnlinePaymentMethod, ADMIN_ONLY_ISSUE_MESSAGE } from '@/lib/payment-methods'
import { publicOrigin } from '@/lib/public-url'
import { isZeroPrice } from '@/lib/money'
import { requireAdmin } from '@/lib/auth'
import { signupCampaignPath, signupTokenFromRequest } from '@/lib/signup-campaigns'

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

    if (isManualPaymentMethod(membership.paymentMethod)) {
      return NextResponse.json(
        { error: 'This membership is set to cash or in person. Mark it paid from the membership page.' },
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

    const origin = publicOrigin(request)
    const cardToken = membership.accessToken || ''
    const successUrl =
      returnUrl ||
      `${origin}/membership/card/${membershipId}?token=${encodeURIComponent(cardToken)}&paid=1`
    const signupToken = signupTokenFromRequest(request)
    const cancelUrl = signupToken
      ? `${origin}${signupCampaignPath(signupToken)}?cancelled=true`
      : `${origin}/membership/register?cancelled=true`

    if (isZeroPrice(subscriptionPlan.price)) {
      const { error: authError } = await requireAdmin(request)
      if (authError) {
        return NextResponse.json({ error: ADMIN_ONLY_ISSUE_MESSAGE }, { status: 403 })
      }
      const open = latestOpenMembershipPayment(
        await paymentTransactionsCollection.findByMembershipId(membershipId)
      )
      if (open) {
        await paymentTransactionsCollection.update(open.id, {
          status: 'COMPLETED',
          amount: 0,
          paymentMethod: 'COMPLIMENTARY',
          provider: 'COMPLIMENTARY',
          metadata: { ...(open.metadata || {}), reason: 'free_plan' },
        })
      } else {
        await paymentTransactionsCollection.create({
          tenantId: tenant.id,
          membershipId,
          amount: 0,
          currency: subscriptionPlan.currency,
          paymentMethod: 'COMPLIMENTARY',
          provider: 'COMPLIMENTARY',
          status: 'COMPLETED',
          metadata: { reason: 'free_plan' },
        })
      }
      await fulfillPaidMembership(membershipId)
      return NextResponse.json({
        fulfilled: true,
        redirectUrl: successUrl,
        paymentUrl: successUrl,
        paymentMethod: 'COMPLIMENTARY',
      })
    }

    const options = await publicPaymentOptions(tenant)
    const requested =
      body.paymentMethod === 'CARD' || body.paymentMethod === 'OPEN_BANKING'
        ? body.paymentMethod
        : membership.paymentMethod
    const methodError = onlinePaymentMethodError(requested, options)
    if (methodError) {
      return NextResponse.json({ error: methodError }, { status: 400 })
    }
    if (!hasOnlineCheckout(options)) {
      return NextResponse.json(
        { error: 'No online payment methods are enabled for this venue.' },
        { status: 400 }
      )
    }
    const paymentMethod =
      requested === 'CARD' && options.card.length > 0
        ? 'CARD'
        : options.openBanking
          ? 'OPEN_BANKING'
          : 'CARD'

    if (!isOnlinePaymentMethod(paymentMethod)) {
      return NextResponse.json({ error: 'Online checkout is not available for this payment method.' }, { status: 400 })
    }

    if (paymentMethod === 'CARD' && options.card.length === 0) {
      return NextResponse.json(
        {
          error:
            'Card payments are not live for this venue. Enable Stripe in Venue settings, or pay by open banking.',
        },
        { status: 400 }
      )
    }

    if (paymentMethod === 'CARD') {
      const processor = resolveLiveCardProcessor(tenant.cardPayments, typeof body.processor === 'string' ? body.processor : '')
      if (!processor) {
        return NextResponse.json({ error: 'No live card processor is configured for this venue.' }, { status: 400 })
      }
      if (processor.id !== 'stripe') {
        return NextResponse.json(
          {
            error: `${processor.name} credentials are saved, but live card checkout currently uses Stripe.`,
          },
          { status: 400 }
        )
      }

      const paymentResult = await createStripeCheckout({
        secretKey: stripeSecretFromPayments(tenant.cardPayments),
        amountGbp: subscriptionPlan.price,
        currency: subscriptionPlan.currency,
        description: `Membership: ${subscriptionPlan.name} for ${member.name}`,
        customerEmail: member.email,
        successUrl: `${origin}/api/payments/return?membershipId=${encodeURIComponent(membershipId)}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl,
        clientReferenceId: membershipId,
        metadata: {
          kind: 'membership',
          membershipId,
          memberId: member.id,
          planId: subscriptionPlan.id,
          tenantId: tenant.id,
          returnUrl: successUrl,
        },
      })

      if (!paymentResult.success || !paymentResult.paymentUrl) {
        return NextResponse.json(
          { error: (!paymentResult.success && paymentResult.error) || 'Could not start card payment' },
          { status: 502 }
        )
      }

      const pending = await ensurePendingMembershipPayment({
        tenantId: tenant.id,
        membershipId,
        amount: subscriptionPlan.price,
        currency: subscriptionPlan.currency,
        paymentMethod: 'CARD',
      })
      await paymentTransactionsCollection.update(pending.id, {
        provider: 'STRIPE',
        externalId: paymentResult.paymentId,
        status: 'PENDING',
        metadata: { kind: 'membership', processor: processor.id, returnUrl: successUrl },
      })

      await membershipsCollection.update(membershipId, {
        paymentId: paymentResult.paymentId,
        paymentMethod: 'CARD',
        paymentStatus: 'PROCESSING',
      })

      return NextResponse.json({
        paymentId: paymentResult.paymentId,
        paymentUrl: paymentResult.paymentUrl,
        redirectUrl: paymentResult.paymentUrl,
        paymentMethod: 'CARD',
        provider: processor.id,
      })
    }

    const creditor = await creditorForTenant(tenant)
    const paymentResult = await initiateOpenBankingPayment({
      amountGbp: subscriptionPlan.price,
      currency: subscriptionPlan.currency,
      reference: membershipId,
      description: `Membership: ${subscriptionPlan.name} for ${member.name}`,
      customerEmail: member.email,
      creditor,
      successUrl: `${origin}/api/payments/return?membershipId=${encodeURIComponent(membershipId)}`,
      cancelUrl,
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

    const pending = await ensurePendingMembershipPayment({
      tenantId: tenant.id,
      membershipId,
      amount: subscriptionPlan.price,
      currency: subscriptionPlan.currency,
      paymentMethod: 'OPEN_BANKING',
    })
    await paymentTransactionsCollection.update(pending.id, {
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
      paymentMethod: 'OPEN_BANKING',
      provider: 'HOPE_MACY',
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
    const paymentId = searchParams.get('paymentId') || searchParams.get('poId') || searchParams.get('po') || searchParams.get('session_id')

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
