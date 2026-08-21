import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, paymentTransactionsCollection } from '@/lib/db'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'
import { mockPaymentsAllowed } from '@/lib/hopemacy'
import { creditsErrorResponse, fulfillCreditPurchase } from '@/lib/tenancy'

function isMockPaymentId(value?: string | null) {
  return Boolean(value && value.startsWith('mock_'))
}

export async function POST(request: NextRequest) {
  try {
    if (!mockPaymentsAllowed()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const { membershipId, paymentId, status } = body

    if (!isMockPaymentId(paymentId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (body.kind === 'credits' || (!membershipId && paymentId)) {
      const transaction = paymentId
        ? await paymentTransactionsCollection.findByExternalId(paymentId)
        : null
      if (!transaction?.creditPurchase || !isMockPaymentId(transaction.externalId || paymentId)) {
        return NextResponse.json({ error: 'Credit pack purchase not found' }, { status: 404 })
      }
      if (status === 'success') {
        const result = await fulfillCreditPurchase(transaction)
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, status: 'COMPLETED' })
      }
      await paymentTransactionsCollection.update(transaction.id, { status: 'FAILED' })
      return NextResponse.json({ success: true, status: 'FAILED' })
    }

    const membership = await membershipsCollection.findById(membershipId)

    if (!membership || membership.paymentId !== paymentId || !isMockPaymentId(membership.paymentId)) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    if (status === 'success') {
      await fulfillPaidMembership(membershipId)

      if (membership.paymentId) {
        await paymentTransactionsCollection.updateByExternalId(membership.paymentId, {
          status: 'COMPLETED',
        })
      }

      return NextResponse.json({ success: true, status: 'COMPLETED' })
    }

    await membershipsCollection.update(membershipId, {
      paymentStatus: 'FAILED',
    })

    if (membership.paymentId) {
      await paymentTransactionsCollection.updateByExternalId(membership.paymentId, {
        status: 'FAILED',
      })
    }

    return NextResponse.json({ success: true, status: 'FAILED' })
  } catch (error) {
    const credits = creditsErrorResponse(error)
    if (credits) return credits
    console.error('Error completing mock payment:', error)
    return NextResponse.json({ error: 'Failed to complete payment' }, { status: 500 })
  }
}
