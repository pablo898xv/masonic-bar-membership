import { NextRequest, NextResponse } from 'next/server'
import {
  membershipsCollection,
  membersCollection,
  membershipNumbersCollection,
  subscriptionPlansCollection,
  tenantsCollection,
  paymentTransactionsCollection,
} from '@/lib/db'
import { canAccessMembership, membershipAccessToken, membershipNotFound } from '@/lib/membership-access'
import { ensurePendingMembershipPayment, latestOpenMembershipPayment } from '@/lib/membership-payment'
import { isManualPaymentMethod, isMembershipPaymentMethod, isOnlinePaymentMethod, ADMIN_ONLY_ISSUE_MESSAGE } from '@/lib/payment-methods'
import { onlinePaymentMethodError, publicPaymentOptions } from '@/lib/payment-options'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'
import { isZeroPrice } from '@/lib/money'
import { getAuthenticatedUser } from '@/lib/auth'
import { isRenewalPayment, renewalWindowError, renewedExpiryDate } from '@/lib/renewal'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { subscriptionPlanId, paymentMethod } = body

    const existingMembership = await membershipsCollection.findById(id)
    const token = membershipAccessToken(request, body)

    if (!canAccessMembership(request, existingMembership, token)) {
      return membershipNotFound()
    }
    if (!existingMembership) return membershipNotFound()

    const windowError = renewalWindowError(existingMembership)
    if (windowError) {
      return NextResponse.json({ error: windowError }, { status: 400 })
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

    const tenant = await tenantsCollection.findById(existingMembership.tenantId)
    if (!tenant) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }
    const options = await publicPaymentOptions(tenant)
    const freePlan = isZeroPrice(subscriptionPlan.price)
    let pendingMethod = isMembershipPaymentMethod(paymentMethod)
      ? paymentMethod
      : isMembershipPaymentMethod(existingMembership.paymentMethod)
        ? existingMembership.paymentMethod
        : options.defaultMethod
    if (freePlan && !isManualPaymentMethod(pendingMethod)) {
      pendingMethod = 'COMPLIMENTARY'
    }
    if (isOnlinePaymentMethod(pendingMethod) && !freePlan) {
      const methodError = onlinePaymentMethodError(pendingMethod, options)
      if (methodError) {
        return NextResponse.json({ error: methodError }, { status: 400 })
      }
    }

    const staffOnlyIssue = pendingMethod === 'COMPLIMENTARY' && !freePlan
    if (staffOnlyIssue && !(await getAuthenticatedUser(request))) {
      return NextResponse.json({ error: ADMIN_ONLY_ISSUE_MESSAGE }, { status: 403 })
    }

    const fromExpiry = existingMembership.expiryDate || new Date()
    const nextExpiry = renewedExpiryDate(fromExpiry, subscriptionPlan.durationYears)
    const renewalMeta = {
      kind: 'RENEWAL',
      subscriptionPlanId: subscriptionPlan.id,
      durationYears: subscriptionPlan.durationYears,
      fromExpiry: fromExpiry.toISOString(),
      cardNumber: membershipNumber.cardNumber,
    }

    const open = latestOpenMembershipPayment(
      await paymentTransactionsCollection.findByMembershipId(existingMembership.id)
    )
    if (open && !isRenewalPayment(open) && existingMembership.status === 'PENDING_PAYMENT') {
      return NextResponse.json(
        { error: 'Finish the outstanding payment on this membership before renewing.' },
        { status: 400 }
      )
    }

    const freeIssue = pendingMethod === 'COMPLIMENTARY' || freePlan
    if (freeIssue) {
      if (open) {
        await paymentTransactionsCollection.update(open.id, {
          amount: 0,
          currency: subscriptionPlan.currency,
          paymentMethod: 'COMPLIMENTARY',
          provider: 'COMPLIMENTARY',
          status: 'COMPLETED',
          metadata: {
            ...(open.metadata || {}),
            ...renewalMeta,
            reason: pendingMethod === 'COMPLIMENTARY' ? 'complimentary' : 'free_plan',
          },
        })
      } else {
        await paymentTransactionsCollection.create({
          tenantId: existingMembership.tenantId,
          membershipId: existingMembership.id,
          amount: 0,
          currency: subscriptionPlan.currency,
          paymentMethod: 'COMPLIMENTARY',
          provider: 'COMPLIMENTARY',
          status: 'COMPLETED',
          metadata: {
            ...renewalMeta,
            reason: pendingMethod === 'COMPLIMENTARY' ? 'complimentary' : 'free_plan',
          },
        })
      }
      await fulfillPaidMembership(existingMembership.id)
      const result = await membershipsCollection.findByIdWithRelations(existingMembership.id)
      return NextResponse.json({
        ...result,
        membership: result?.membership,
        previousMembershipId: existingMembership.id,
        nextExpiry,
        freeIssue: true,
        paymentRequired: null,
      }, { status: 201 })
    }

    await ensurePendingMembershipPayment({
      tenantId: existingMembership.tenantId,
      membershipId: existingMembership.id,
      amount: subscriptionPlan.price,
      currency: subscriptionPlan.currency,
      paymentMethod: pendingMethod,
      metadata: renewalMeta,
    })

    const result = await membershipsCollection.findByIdWithRelations(existingMembership.id)

    return NextResponse.json({
      ...result,
      membership: result?.membership,
      previousMembershipId: existingMembership.id,
      nextExpiry,
      paymentRequired: {
        amount: subscriptionPlan.price,
        currency: subscriptionPlan.currency,
        membershipId: existingMembership.id,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error renewing membership:', error)
    return NextResponse.json({ error: 'Failed to renew membership' }, { status: 500 })
  }
}
