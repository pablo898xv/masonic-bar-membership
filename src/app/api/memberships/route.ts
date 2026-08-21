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
import { ensurePendingMembershipPayment } from '@/lib/membership-payment'
import { isManualPaymentMethod, isOnlinePaymentMethod, ADMIN_ONLY_ISSUE_MESSAGE } from '@/lib/payment-methods'
import { formatMagstripeData } from '@/lib/settings'
import { v4 as uuidv4 } from 'uuid'
import { requireAdmin, getAuthenticatedUser } from '@/lib/auth'
import { assertCreditsAvailable, creditsNeeded, requireTenant } from '@/lib/tenancy'
import { allocateCardShortCode } from '@/lib/card-link'
import { onlinePaymentMethodError, publicPaymentOptions } from '@/lib/payment-options'
import { memberCardBlock } from '@/lib/member-card-limit'
import { isZeroPrice } from '@/lib/money'
import { requirePublicSignupCampaign } from '@/lib/signup-campaigns'
import { allocateMembershipNumber, markNumberAssigned } from '@/lib/card-number-alloc'
import { hasPhysicalCard, passTypesOf, venueOffersCardType } from '@/lib/card-type'

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || undefined
    const cardType = searchParams.get('cardType') || undefined
    
    const { memberships, total } = await membershipsCollection.findMany({
      tenantId: tenant.id,
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
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const body = await request.json()
    
    const validation = membershipPurchaseSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const { memberId, subscriptionPlanId, cardType, paymentMethod, adminIssued } = validation.data
    const staffUser = await getAuthenticatedUser(request)
    const staffIssue = Boolean(staffUser) && adminIssued === true
    let signupCampaignId: string | undefined

    if (!staffIssue) {
      const { campaign, error: campaignError } = await requirePublicSignupCampaign(request, tenant.id)
      if (campaignError) return campaignError
      signupCampaignId = campaign?.id
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

    if (member.tenantId !== tenant.id || subscriptionPlan.tenantId !== tenant.id) {
      return NextResponse.json({ error: 'Member or plan does not belong to this venue' }, { status: 403 })
    }

    if (!venueOffersCardType(passTypesOf(tenant.passTypes), cardType)) {
      return NextResponse.json(
        { error: 'This venue does not offer that pass type. Choose one of the options on the signup form.' },
        { status: 400 }
      )
    }

    const staffOnlyIssue =
      paymentMethod === 'COMPLIMENTARY' ||
      isManualPaymentMethod(paymentMethod)

    const freePlan = isZeroPrice(subscriptionPlan.price)

    if (staffOnlyIssue) {
      const { error: authError } = await requireAdmin(request)
      if (authError) {
        return NextResponse.json({ error: ADMIN_ONLY_ISSUE_MESSAGE }, { status: 403 })
      }
      if (adminIssued !== true) {
        return NextResponse.json({ error: ADMIN_ONLY_ISSUE_MESSAGE }, { status: 403 })
      }
    } else if (!freePlan) {
      if (!isOnlinePaymentMethod(paymentMethod)) {
        return NextResponse.json({ error: 'Choose a payment method' }, { status: 400 })
      }
      const methodError = onlinePaymentMethodError(paymentMethod, await publicPaymentOptions(tenant))
      if (methodError) {
        return NextResponse.json({ error: methodError }, { status: 400 })
      }
    }

    const cardBlock = await memberCardBlock(member.id, tenant.id, adminIssued ? 'admin' : 'public')
    if (cardBlock) {
      return NextResponse.json(cardBlock, { status: 409 })
    }

    const needed = creditsNeeded(cardType)
    const credits = await assertCreditsAvailable(tenant.id, needed)
    if (!credits.ok) {
      return NextResponse.json({ error: credits.error }, { status: credits.status })
    }
    
    const allocated = await allocateMembershipNumber(tenant, cardType)
    if (!allocated.ok) {
      return NextResponse.json({ error: allocated.error }, { status: allocated.status })
    }
    const availableNumber = allocated.number
    
    await markNumberAssigned(availableNumber)
    
    const isComplimentary = paymentMethod === 'COMPLIMENTARY'
    const freeIssue = isComplimentary || freePlan
    const collectedNow = freeIssue || isManualPaymentMethod(paymentMethod)
    const recordedMethod =
      isComplimentary || freePlan
        ? isManualPaymentMethod(paymentMethod)
          ? paymentMethod
          : 'COMPLIMENTARY'
        : paymentMethod
    if (!recordedMethod) {
      return NextResponse.json({ error: 'Choose a payment method' }, { status: 400 })
    }
    const membershipData: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'> = {
      tenantId: tenant.id,
      memberId,
      membershipNumberId: availableNumber.id,
      subscriptionPlanId,
      cardType,
      status: collectedNow ? 'PAID' : 'PENDING_PAYMENT',
      paymentMethod: recordedMethod,
      paymentStatus: collectedNow ? 'COMPLETED' : 'PENDING',
      tillSystemEnabled: false,
      accessToken: uuidv4(),
      shortCode: await allocateCardShortCode(),
      ...(signupCampaignId ? { signupCampaignId } : {}),
    }
    
    const membership = await membershipsCollection.create(membershipData)
    
    if (hasPhysicalCard(cardType)) {
      const magstripeData = await formatMagstripeData(availableNumber.cardNumber, tenant.id)
      
      await cardIssuancesCollection.create({
        membershipId: membership.id,
        tenantId: tenant.id,
        queueStatus: collectedNow ? 'READY_TO_ENCODE' : 'PENDING',
        magstripeData,
      })
    }

    if (freeIssue) {
      await paymentTransactionsCollection.create({
        tenantId: tenant.id,
        membershipId: membership.id,
        amount: 0,
        currency: subscriptionPlan.currency,
        paymentMethod: recordedMethod,
        provider: recordedMethod === 'COMPLIMENTARY' ? 'COMPLIMENTARY' : 'MANUAL',
        status: 'COMPLETED',
        metadata: {
          issuedBy: adminIssued ? 'admin' : 'self-serve',
          reason: isComplimentary ? 'complimentary' : 'free_plan',
        },
      })

      await fulfillPaidMembership(membership.id)

      const result = await membershipsCollection.findByIdWithRelations(membership.id)
      return NextResponse.json({
        ...result,
        complimentary: isComplimentary,
        freeIssue: true,
        paymentRequired: null,
      }, { status: 201 })
    }

    if (isManualPaymentMethod(paymentMethod)) {
      await paymentTransactionsCollection.create({
        tenantId: tenant.id,
        membershipId: membership.id,
        amount: subscriptionPlan.price,
        currency: subscriptionPlan.currency,
        paymentMethod,
        provider: 'MANUAL',
        status: 'COMPLETED',
        metadata: { issuedBy: 'admin', collectedAtVenue: true },
      })

      await fulfillPaidMembership(membership.id)

      const result = await membershipsCollection.findByIdWithRelations(membership.id)
      return NextResponse.json({
        ...result,
        collectedInPerson: true,
        paymentRequired: null,
      }, { status: 201 })
    }

    await ensurePendingMembershipPayment({
      tenantId: tenant.id,
      membershipId: membership.id,
      amount: subscriptionPlan.price,
      currency: subscriptionPlan.currency,
      paymentMethod: recordedMethod,
    })
    
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
    const message = error instanceof Error ? error.message : 'Failed to create membership'
    if (message.includes('credits')) {
      return NextResponse.json({ error: message }, { status: 402 })
    }
    console.error('Error creating membership:', error)
    return NextResponse.json({ error: 'Failed to create membership' }, { status: 500 })
  }
}
