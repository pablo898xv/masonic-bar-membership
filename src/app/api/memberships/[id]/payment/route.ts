import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, paymentTransactionsCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import {
  latestOpenMembershipPayment,
  markMembershipPaid,
  setMembershipPaymentMethod,
} from '@/lib/membership-payment'
import { belongsToTenant, creditsErrorResponse, requireTenant } from '@/lib/tenancy'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    const membership = await membershipsCollection.findById(id)
    if (!membership || !belongsToTenant(membership, tenant.id)) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const transactions = await paymentTransactionsCollection.findByMembershipId(id)
    return NextResponse.json({
      paymentMethod: membership.paymentMethod || null,
      paymentStatus: membership.paymentStatus,
      pending: latestOpenMembershipPayment(transactions),
      transactions,
    })
  } catch (error) {
    console.error('Error loading membership payment:', error)
    return NextResponse.json({ error: 'Failed to load payment' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    const membership = await membershipsCollection.findById(id)
    if (!membership || !belongsToTenant(membership, tenant.id)) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action === 'mark_paid' ? 'mark_paid' : 'set_method'

    if (action === 'set_method') {
      const result = await setMembershipPaymentMethod(id, body.paymentMethod)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json(result)
    }

    const result = await markMembershipPaid(id, {
      paymentMethod: body.paymentMethod,
      note: typeof body.note === 'string' ? body.note : '',
      approvedBy: user.name || user.email,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const updated = await membershipsCollection.findByIdWithRelations(id)
    return NextResponse.json({ ...result, membership: updated })
  } catch (error) {
    const credits = creditsErrorResponse(error)
    if (credits) return credits
    console.error('Error updating membership payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}
