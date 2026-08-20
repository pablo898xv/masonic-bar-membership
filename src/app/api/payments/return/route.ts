import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, paymentTransactionsCollection } from '@/lib/db'
import {
  findLatestPendingCreditPurchase,
  reconcileTransaction,
} from '@/lib/open-banking'
import { requireTenant } from '@/lib/tenancy'

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}

function returnPath(metadata?: Record<string, unknown>, fallback = '/') {
  const value = typeof metadata?.returnUrl === 'string' ? metadata.returnUrl : ''
  if (!value) return fallback
  try {
    const parsed = new URL(value)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return value.startsWith('/') ? value : fallback
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const paymentId = searchParams.get('paymentId') || searchParams.get('poId') || ''
  const membershipId = searchParams.get('membershipId') || ''
  const kind = searchParams.get('kind') || ''

  try {
    let transaction = paymentId
      ? await paymentTransactionsCollection.findByExternalId(paymentId)
      : null

    if (!transaction && membershipId) {
      const membership = await membershipsCollection.findById(membershipId)
      if (membership?.paymentId) {
        transaction = await paymentTransactionsCollection.findByExternalId(membership.paymentId)
      }
    }

    if (!transaction && kind === 'credits') {
      const { tenant } = await requireTenant(request)
      transaction = tenant ? await findLatestPendingCreditPurchase(tenant.id) : null
    }

    if (!transaction) {
      if (kind === 'credits') return redirectTo(request, '/admin/credits?cancelled=1')
      if (membershipId) {
        return redirectTo(
          request,
          `/membership/payment-complete?membershipId=${encodeURIComponent(membershipId)}&status=pending`
        )
      }
      return redirectTo(request, '/')
    }

    const result = await reconcileTransaction(transaction)
    if (transaction.creditPurchase) {
      return redirectTo(
        request,
        result.status === 'COMPLETED' ? '/admin/credits?paid=1' : '/admin/credits?cancelled=1'
      )
    }

    const mid = transaction.membershipId || membershipId
    const membership = mid ? await membershipsCollection.findById(mid) : null
    const token = encodeURIComponent(membership?.accessToken || '')
    if (result.status === 'COMPLETED' && mid) {
      return redirectTo(
        request,
        returnPath(transaction.metadata, `/membership/card/${mid}?token=${token}&paid=1`)
      )
    }

    return redirectTo(
      request,
      `/membership/payment-complete?membershipId=${encodeURIComponent(mid || '')}&status=${
        result.status === 'FAILED' ? 'failed' : 'pending'
      }`
    )
  } catch (error) {
    console.error('Error handling Hope Macy return:', error)
    if (kind === 'credits') return redirectTo(request, '/admin/credits?cancelled=1')
    if (membershipId) {
      return redirectTo(
        request,
        `/membership/payment-complete?membershipId=${encodeURIComponent(membershipId)}&status=failed`
      )
    }
    return redirectTo(request, '/')
  }
}
