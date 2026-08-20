import {
  membershipsCollection,
  paymentTransactionsCollection,
  PaymentTransaction,
} from '@/lib/db'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'
import { getPaymentOrderStatus, HopeMacyStatus } from '@/lib/hopemacy'
import { fulfillCreditPurchase } from '@/lib/tenancy'

export type ReconcileResult = {
  ok: boolean
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  error?: string
}

function failedStatus(hm: HopeMacyStatus) {
  return hm === 'FAILED' || hm === 'VOIDED'
}

async function applyFailed(transaction: PaymentTransaction) {
  await paymentTransactionsCollection.update(transaction.id, { status: 'FAILED' })
  if (transaction.membershipId) {
    await membershipsCollection.update(transaction.membershipId, { paymentStatus: 'FAILED' })
  }
}

export async function reconcileTransaction(transaction: PaymentTransaction): Promise<ReconcileResult> {
  if (transaction.status === 'COMPLETED' || transaction.status === 'REFUNDED') {
    return { ok: true, status: transaction.status }
  }

  const externalId = transaction.externalId || ''
  if (!externalId) {
    return { ok: false, status: 'PENDING', error: 'No payment order id' }
  }

  if (externalId.startsWith('mock_')) {
    return { ok: true, status: transaction.status }
  }

  let hmStatus: HopeMacyStatus
  try {
    hmStatus = await getPaymentOrderStatus(externalId)
  } catch (error) {
    console.error('Hope Macy status poll failed', error)
    return { ok: false, status: transaction.status, error: 'Could not read Hope Macy payment status' }
  }

  if (hmStatus === 'COMPLETED') {
    if (transaction.creditPurchase) {
      const result = await fulfillCreditPurchase(transaction)
      if (!result.ok) return { ok: false, status: 'PENDING', error: result.error }
      return { ok: true, status: 'COMPLETED' }
    }
    if (transaction.membershipId) {
      await fulfillPaidMembership(transaction.membershipId)
      await paymentTransactionsCollection.update(transaction.id, { status: 'COMPLETED' })
      return { ok: true, status: 'COMPLETED' }
    }
    await paymentTransactionsCollection.update(transaction.id, { status: 'COMPLETED' })
    return { ok: true, status: 'COMPLETED' }
  }

  if (failedStatus(hmStatus)) {
    await applyFailed(transaction)
    return { ok: true, status: 'FAILED' }
  }

  if (hmStatus === 'PROCESSING' && transaction.status !== 'PROCESSING') {
    await paymentTransactionsCollection.update(transaction.id, { status: 'PROCESSING' })
    if (transaction.membershipId) {
      await membershipsCollection.update(transaction.membershipId, { paymentStatus: 'PROCESSING' })
    }
    return { ok: true, status: 'PROCESSING' }
  }

  return { ok: true, status: transaction.status === 'PROCESSING' ? 'PROCESSING' : 'PENDING' }
}

export async function reconcileByExternalId(externalId: string): Promise<ReconcileResult> {
  const transaction = await paymentTransactionsCollection.findByExternalId(externalId)
  if (!transaction) {
    return { ok: false, status: 'PENDING', error: 'Payment not found' }
  }
  return reconcileTransaction(transaction)
}

export async function reconcileMembershipPayment(membershipId: string): Promise<ReconcileResult> {
  const membership = await membershipsCollection.findById(membershipId)
  if (!membership?.paymentId) {
    return { ok: false, status: 'PENDING', error: 'No payment initiated for this membership' }
  }
  return reconcileByExternalId(membership.paymentId)
}

export async function findLatestPendingCreditPurchase(tenantId: string) {
  const dbTransactions = await paymentTransactionsCollection.findByTenantId(tenantId)
  return (
    dbTransactions
      .filter(
        (item) =>
          item.creditPurchase &&
          (item.status === 'PENDING' || item.status === 'PROCESSING')
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
  )
}
