import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection, 
  subscriptionPlansCollection,
  cardIssuancesCollection,
  tenantsCollection,
  paymentTransactionsCollection,
  Membership
} from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { formatMagstripeData } from '@/lib/settings'
import { canAccessMembership, membershipAccessToken, membershipNotFound } from '@/lib/membership-access'
import { allocateCardShortCode } from '@/lib/card-link'
import { ensurePendingMembershipPayment } from '@/lib/membership-payment'
import { isMembershipPaymentMethod, isOnlinePaymentMethod, ADMIN_ONLY_ISSUE_MESSAGE } from '@/lib/payment-methods'
import { onlinePaymentMethodError, publicPaymentOptions } from '@/lib/payment-options'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'
import { isZeroPrice } from '@/lib/money'
import { getAuthenticatedUser } from '@/lib/auth'

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

    const tenant = await tenantsCollection.findById(existingMembership.tenantId)
    if (!tenant) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }
    const options = await publicPaymentOptions(tenant)
    const pendingMethod = isMembershipPaymentMethod(paymentMethod)
      ? paymentMethod
      : isMembershipPaymentMethod(existingMembership.paymentMethod)
        ? existingMembership.paymentMethod
        : options.defaultMethod
    if (isOnlinePaymentMethod(pendingMethod) && !isZeroPrice(subscriptionPlan.price)) {
      const methodError = onlinePaymentMethodError(pendingMethod, options)
      if (methodError) {
        return NextResponse.json({ error: methodError }, { status: 400 })
      }
    }

    const staffOnlyIssue = pendingMethod === 'COMPLIMENTARY' || isZeroPrice(subscriptionPlan.price)
    if (staffOnlyIssue && !(await getAuthenticatedUser(request))) {
      return NextResponse.json({ error: ADMIN_ONLY_ISSUE_MESSAGE }, { status: 403 })
    }
    
    const membershipData: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'> = {
      tenantId: existingMembership.tenantId,
      memberId: existingMembership.memberId,
      membershipNumberId: existingMembership.membershipNumberId,
      subscriptionPlanId,
      cardType: existingMembership.cardType,
      status: 'PENDING_PAYMENT',
      paymentMethod: pendingMethod,
      paymentStatus: 'PENDING',
      tillSystemEnabled: false,
      accessToken: uuidv4(),
      shortCode: await allocateCardShortCode(),
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

    const freeIssue = pendingMethod === 'COMPLIMENTARY' || isZeroPrice(subscriptionPlan.price)
    if (freeIssue) {
      await paymentTransactionsCollection.create({
        tenantId: existingMembership.tenantId,
        membershipId: newMembership.id,
        amount: 0,
        currency: subscriptionPlan.currency,
        paymentMethod: 'COMPLIMENTARY',
        provider: 'COMPLIMENTARY',
        status: 'COMPLETED',
        metadata: { reason: pendingMethod === 'COMPLIMENTARY' ? 'complimentary' : 'free_plan', renewalOf: existingMembership.id },
      })
      await fulfillPaidMembership(newMembership.id)
      const result = await membershipsCollection.findByIdWithRelations(newMembership.id)
      return NextResponse.json({
        ...result,
        previousMembershipId: existingMembership.id,
        freeIssue: true,
        paymentRequired: null,
      }, { status: 201 })
    }

    await ensurePendingMembershipPayment({
      tenantId: existingMembership.tenantId,
      membershipId: newMembership.id,
      amount: subscriptionPlan.price,
      currency: subscriptionPlan.currency,
      paymentMethod: pendingMethod,
    })
    
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
