import { v4 as uuidv4 } from 'uuid'
import {
  membersCollection,
  membershipsCollection,
  membershipNumbersCollection,
  paymentTransactionsCollection,
  subscriptionPlansCollection,
  cardIssuancesCollection,
  type MembershipNumber,
  type Tenant,
} from '@/lib/db'
import { allocateCardShortCode, ensureMembershipCardLink } from '@/lib/card-link'
import { formatMagstripeData } from '@/lib/settings'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'
import { findSignupIdentity, memberCardBlock } from '@/lib/member-card-limit'
import { assertCreditsAvailable, creditsNeeded } from '@/lib/tenancy'
import { partnerIssueSchema } from '@/lib/validation'

export type PartnerIssueBody = ReturnType<typeof partnerIssueSchema.parse>

export type PartnerIssueError = {
  ok: false
  status: number
  error: string
  code: string
}

export type PartnerIssueResult = {
  ok: true
  membershipId: string
  memberId: string
  cardNumber: number
  cardNumberCreated: boolean
  cardType: string
  status: string
  plan: { id: string; name: string; durationYears: number }
  notifications: { email: boolean; sms: boolean }
  cardUrl?: string
  shortUrl?: string
}

async function resolveCardNumber(
  tenantId: string,
  requested: number | undefined,
  createIfMissing: boolean
): Promise<{ number: MembershipNumber; created: boolean } | PartnerIssueError> {
  if (!requested) {
    const available = await membershipNumbersCollection.findFirstAvailable(tenantId)
    if (!available) {
      return {
        ok: false,
        status: 400,
        code: 'NO_CARD_NUMBERS',
        error:
          'No card numbers are available. Pass cardNumber with createCardNumber true, or import numbers in admin.',
      }
    }
    return { number: available, created: false }
  }

  const existing = await membershipNumbersCollection.findByCardNumber(requested, tenantId)
  if (existing?.isAssigned) {
    return {
      ok: false,
      status: 409,
      code: 'CARD_NUMBER_IN_USE',
      error: `Card number ${requested} is already assigned at this venue.`,
    }
  }
  if (existing) return { number: existing, created: false }

  if (!createIfMissing) {
    return {
      ok: false,
      status: 404,
      code: 'CARD_NUMBER_NOT_ENROLLED',
      error: `Card number ${requested} is not enrolled. Pass createCardNumber true to add it.`,
    }
  }

  await membershipNumbersCollection.createMany([{ cardNumber: requested, batchId: 'partner-api' }], tenantId)
  const created = await membershipNumbersCollection.findByCardNumber(requested, tenantId)
  if (!created) {
    return { ok: false, status: 500, code: 'CARD_NUMBER_CREATE_FAILED', error: 'Could not create that card number.' }
  }
  return { number: created, created: true }
}

export async function issuePartnerMembership(
  tenant: Tenant,
  body: PartnerIssueBody
): Promise<PartnerIssueResult | PartnerIssueError> {
  const plan = await subscriptionPlansCollection.findById(body.subscriptionPlanId)
  if (!plan || !plan.isActive || plan.tenantId !== tenant.id) {
    return { ok: false, status: 404, code: 'PLAN_NOT_FOUND', error: 'Subscription plan not found or inactive' }
  }

  const cardType = body.cardType || 'QR_CODE'
  const credits = await assertCreditsAvailable(tenant.id, creditsNeeded(cardType))
  if (!credits.ok) {
    return { ok: false, status: credits.status, code: 'NO_CREDITS', error: credits.error }
  }

  const identity = await findSignupIdentity(tenant.id, body.member.email, body.member.phone)
  if (identity.conflict) {
    return {
      ok: false,
      status: 409,
      code: 'DETAILS_CONFLICT',
      error: 'That email and phone belong to two different members.',
    }
  }

  let member = identity.member
  if (member) {
    const block = await memberCardBlock(member.id, tenant.id, 'admin')
    if (block) {
      return { ok: false, status: 409, code: block.code, error: block.error }
    }
  } else {
    member = await membersCollection.create({
      tenantId: tenant.id,
      name: body.member.name,
      email: body.member.email,
      phone: body.member.phone,
    })
  }

  const resolved = await resolveCardNumber(tenant.id, body.cardNumber, body.createCardNumber === true)
  if ('ok' in resolved) return resolved

  const card = resolved.number
  await membershipNumbersCollection.update(card.id, { isAssigned: true, assignedAt: new Date() })

  const membership = await membershipsCollection.create({
    tenantId: tenant.id,
    memberId: member.id,
    membershipNumberId: card.id,
    subscriptionPlanId: plan.id,
    cardType,
    status: 'PAID',
    paymentMethod: 'COMPLIMENTARY',
    paymentStatus: 'COMPLETED',
    tillSystemEnabled: false,
    accessToken: uuidv4(),
    shortCode: await allocateCardShortCode(),
  })

  if (cardType === 'PHYSICAL_CARD') {
    await cardIssuancesCollection.create({
      membershipId: membership.id,
      tenantId: tenant.id,
      queueStatus: 'READY_TO_ENCODE',
      magstripeData: await formatMagstripeData(card.cardNumber, tenant.id),
    })
  }

  await paymentTransactionsCollection.create({
    tenantId: tenant.id,
    membershipId: membership.id,
    amount: 0,
    currency: plan.currency,
    paymentMethod: 'COMPLIMENTARY',
    provider: 'COMPLIMENTARY',
    status: 'COMPLETED',
    metadata: { issuedBy: 'partner-api', reason: 'partner_issue' },
  })

  const notifyEmail = body.notifications?.email !== false
  const notifySms = body.notifications?.sms !== false
  try {
    await fulfillPaidMembership(membership.id, { notifyEmail, notifySms })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to issue membership'
    return { ok: false, status: message.toLowerCase().includes('credit') ? 402 : 500, code: 'ISSUE_FAILED', error: message }
  }

  const updated = await membershipsCollection.findById(membership.id)
  const link = updated ? await ensureMembershipCardLink(updated) : null
  const includeUrl = body.returnCardUrl !== false

  return {
    ok: true,
    membershipId: membership.id,
    memberId: member.id,
    cardNumber: card.cardNumber,
    cardNumberCreated: resolved.created,
    cardType,
    status: updated?.status || 'ACTIVE',
    plan: { id: plan.id, name: plan.name, durationYears: plan.durationYears },
    notifications: { email: notifyEmail, sms: notifySms },
    ...(includeUrl && link
      ? { cardUrl: link.cardUrl, shortUrl: link.shortUrl }
      : {}),
  }
}
