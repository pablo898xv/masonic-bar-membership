import {
  membershipsCollection,
  paymentTransactionsCollection,
  subscriptionPlansCollection,
  tenantsCollection,
  type PaymentTransaction,
} from '@/lib/db'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'
import {
  isManualPaymentMethod,
  isMembershipPaymentMethod,
  isOnlinePaymentMethod,
  paymentMethodLabel,
  paymentProviderFor,
  paymentProviderLabel,
  type MembershipPaymentMethod,
} from '@/lib/payment-methods'
import { onlinePaymentMethodError, publicPaymentOptions } from '@/lib/payment-options'
import { isRenewalPayment } from '@/lib/renewal'

export function latestOpenMembershipPayment(transactions: PaymentTransaction[]) {
  return (
    transactions
      .filter(
        (item) =>
          !item.creditPurchase &&
          (item.status === 'PENDING' || item.status === 'PROCESSING')
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
  )
}

export function latestMembershipPayment(transactions: PaymentTransaction[]) {
  const relevant = transactions.filter((item) => !item.creditPurchase)
  const completed = relevant.filter((item) => item.status === 'COMPLETED')
  const pool = completed.length ? completed : relevant
  return (
    pool.sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    )[0] || null
  )
}

export function membershipPaymentSummary(
  membership: {
    paymentMethod?: string
    paymentStatus?: string
    paymentId?: string
  },
  transactions: PaymentTransaction[]
) {
  const transaction = latestMembershipPayment(transactions)
  const metadata = transaction?.metadata || {}
  const method = transaction?.paymentMethod || membership.paymentMethod
  const provider =
    transaction?.provider ||
    (isMembershipPaymentMethod(method) ? paymentProviderFor(method) : '')
  const reference =
    transaction?.externalId ||
    membership.paymentId ||
    (typeof metadata.paymentIntent === 'string' ? metadata.paymentIntent : '') ||
    ''

  return {
    method: method || null,
    methodLabel: paymentMethodLabel(method),
    provider: provider || null,
    providerLabel: paymentProviderLabel(provider),
    status: transaction?.status || membership.paymentStatus || null,
    amount: transaction?.amount ?? null,
    currency: transaction?.currency || 'GBP',
    reference: reference || null,
    note: typeof metadata.note === 'string' && metadata.note.trim() ? metadata.note.trim() : null,
    recordedBy:
      typeof metadata.approvedBy === 'string' && metadata.approvedBy.trim()
        ? metadata.approvedBy.trim()
        : null,
    paidAt: transaction?.status === 'COMPLETED' ? transaction.updatedAt || transaction.createdAt : null,
  }
}

export async function ensurePendingMembershipPayment(options: {
  tenantId: string
  membershipId: string
  amount: number
  currency: string
  paymentMethod: MembershipPaymentMethod
  metadata?: Record<string, unknown>
}) {
  const existing = latestOpenMembershipPayment(
    await paymentTransactionsCollection.findByMembershipId(options.membershipId)
  )
  if (existing) {
    return paymentTransactionsCollection.update(existing.id, {
      amount: options.amount,
      currency: options.currency,
      paymentMethod: options.paymentMethod,
      provider: paymentProviderFor(options.paymentMethod),
      metadata: { ...(existing.metadata || {}), ...(options.metadata || {}) },
    })
  }

  return paymentTransactionsCollection.create({
    tenantId: options.tenantId,
    membershipId: options.membershipId,
    amount: options.amount,
    currency: options.currency,
    paymentMethod: options.paymentMethod,
    provider: paymentProviderFor(options.paymentMethod),
    status: 'PENDING',
    metadata: options.metadata,
  })
}

export async function setMembershipPaymentMethod(
  membershipId: string,
  paymentMethod: unknown
) {
  if (!isMembershipPaymentMethod(paymentMethod)) {
    return { ok: false as const, status: 400, error: 'Choose card, open banking, cash, in person, or complimentary.' }
  }

  const membership = await membershipsCollection.findById(membershipId)
  if (!membership) return { ok: false as const, status: 404, error: 'Membership not found' }
  const openPayment = latestOpenMembershipPayment(
    await paymentTransactionsCollection.findByMembershipId(membershipId)
  )
  const renewing = isRenewalPayment(openPayment)
  if (membership.status !== 'PENDING_PAYMENT' && !renewing) {
    return { ok: false as const, status: 400, error: 'Only a pending payment can be changed.' }
  }

  const planId =
    typeof openPayment?.metadata?.subscriptionPlanId === 'string'
      ? openPayment.metadata.subscriptionPlanId
      : membership.subscriptionPlanId
  const plan = await subscriptionPlansCollection.findById(planId)
  if (!plan) return { ok: false as const, status: 404, error: 'Subscription plan not found' }

  const tenant = await tenantsCollection.findById(membership.tenantId)
  if (!tenant) return { ok: false as const, status: 404, error: 'Venue not found' }
  if (isOnlinePaymentMethod(paymentMethod)) {
    const methodError = onlinePaymentMethodError(paymentMethod, await publicPaymentOptions(tenant))
    if (methodError) return { ok: false as const, status: 400, error: methodError }
  }

  await membershipsCollection.update(membershipId, {
    paymentMethod,
    paymentStatus: 'PENDING',
  })

  const transaction =
    paymentMethod === 'COMPLIMENTARY'
      ? null
      : await ensurePendingMembershipPayment({
          tenantId: membership.tenantId,
          membershipId,
          amount: plan.price,
          currency: plan.currency,
          paymentMethod,
        })

  return { ok: true as const, paymentMethod, transaction }
}

export async function markMembershipPaid(
  membershipId: string,
  options: {
    paymentMethod?: unknown
    note?: string
    approvedBy?: string
  }
) {
  const membership = await membershipsCollection.findById(membershipId)
  if (!membership) return { ok: false as const, status: 404, error: 'Membership not found' }
  const openRenewal = latestOpenMembershipPayment(
    await paymentTransactionsCollection.findByMembershipId(membershipId)
  )
  const renewing = isRenewalPayment(openRenewal)
  if (membership.status !== 'PENDING_PAYMENT' && !renewing) {
    return { ok: false as const, status: 400, error: 'This membership is not awaiting payment.' }
  }

  const requested = options.paymentMethod
  const collected: MembershipPaymentMethod | null =
    requested === 'COMPLIMENTARY'
      ? 'COMPLIMENTARY'
      : isManualPaymentMethod(String(requested))
        ? (requested as MembershipPaymentMethod)
        : isManualPaymentMethod(membership.paymentMethod)
          ? membership.paymentMethod
          : membership.paymentMethod === 'COMPLIMENTARY'
            ? 'COMPLIMENTARY'
            : null

  if (!collected) {
    return {
      ok: false as const,
      status: 400,
      error: 'Choose cash, in person, or complimentary.',
    }
  }

  const planId =
    typeof openRenewal?.metadata?.subscriptionPlanId === 'string'
      ? openRenewal.metadata.subscriptionPlanId
      : membership.subscriptionPlanId
  const plan = await subscriptionPlansCollection.findById(planId)
  if (!plan) return { ok: false as const, status: 404, error: 'Subscription plan not found' }
  const amount = collected === 'COMPLIMENTARY' ? 0 : plan.price
  const provider = collected === 'COMPLIMENTARY' ? 'COMPLIMENTARY' : 'MANUAL'
  const metadata = {
    collectedAtVenue: collected !== 'COMPLIMENTARY',
    approvedBy: options.approvedBy || 'admin',
    note: options.note || '',
    reason: collected === 'COMPLIMENTARY' ? 'complimentary' : undefined,
  }

  if (openRenewal) {
    await paymentTransactionsCollection.update(openRenewal.id, {
      paymentMethod: collected,
      provider,
      status: 'COMPLETED',
      amount,
      currency: plan.currency,
      metadata: { ...(openRenewal.metadata || {}), ...metadata },
    })
  } else {
    await paymentTransactionsCollection.create({
      tenantId: membership.tenantId,
      membershipId,
      amount,
      currency: plan.currency,
      paymentMethod: collected,
      provider,
      status: 'COMPLETED',
      metadata,
    })
  }

  await membershipsCollection.update(membershipId, {
    paymentMethod: collected,
    paymentStatus: 'COMPLETED',
  })

  await fulfillPaidMembership(membershipId)
  return { ok: true as const, paymentMethod: collected }
}
