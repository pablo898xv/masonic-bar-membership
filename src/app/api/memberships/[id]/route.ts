import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, paymentTransactionsCollection } from '@/lib/db'
import { deleteMembershipAndReleaseCard } from '@/lib/delete-membership'
import { formatMagstripeData } from '@/lib/settings'
import { belongsToTenant, requireTenant } from '@/lib/tenancy'
import { requireAdmin } from '@/lib/auth'
import { hasValidSession } from '@/lib/auth-token'
import { canAccessMembership, membershipNotFound } from '@/lib/membership-access'
import { isPaidMembershipStatus } from '@/lib/payment-methods'
import { latestOpenMembershipPayment, membershipPaymentSummary } from '@/lib/membership-payment'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await membershipsCollection.findByIdWithRelations(id)
    if (!result || !canAccessMembership(request, result.membership)) {
      return membershipNotFound()
    }

    if (!hasValidSession(request)) {
      return NextResponse.json({
        id: result.membership.id,
        cardType: result.membership.cardType,
        status: result.membership.status,
        expiryDate: result.membership.expiryDate,
        member: result.member ? { name: result.member.name, email: result.member.email } : null,
        membershipNumber: result.membershipNumber
          ? { cardNumber: result.membershipNumber.cardNumber }
          : null,
        subscriptionPlan: result.subscriptionPlan
          ? {
              id: result.subscriptionPlan.id,
              name: result.subscriptionPlan.name,
              durationYears: result.subscriptionPlan.durationYears,
              price: result.subscriptionPlan.price,
            }
          : null,
      })
    }

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!belongsToTenant(result.membership, tenant.id)) return membershipNotFound()

    const paid = isPaidMembershipStatus(result.membership.status)
    const transactions = await paymentTransactionsCollection.findByMembershipId(result.membership.id)
    const pendingPayment = latestOpenMembershipPayment(transactions)

    return NextResponse.json({
      ...result.membership,
      member: result.member,
      membershipNumber: result.membershipNumber,
      subscriptionPlan: result.subscriptionPlan,
      cardIssuance: result.cardIssuance || null,
      magstripeData: paid
        ? await formatMagstripeData(result.membershipNumber.cardNumber, result.membership.tenantId)
        : '',
      digitalCardPath:
        paid && result.membership.accessToken
          ? `/membership/card/${result.membership.id}?token=${encodeURIComponent(result.membership.accessToken)}`
          : null,
      pendingPayment,
      payment: membershipPaymentSummary(result.membership, transactions),
    })
  } catch (error) {
    console.error('Error fetching membership:', error)
    return NextResponse.json({ error: 'Failed to fetch membership' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    const body = await request.json()
    
    const existingMembership = await membershipsCollection.findById(id)
    if (!existingMembership || !belongsToTenant(existingMembership, tenant.id)) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    const allowedFields = ['notes']
    const updateData: Record<string, unknown> = {}
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }
    
    const membership = await membershipsCollection.update(id, updateData)
    
    return NextResponse.json(membership)
  } catch (error) {
    console.error('Error updating membership:', error)
    return NextResponse.json({ error: 'Failed to update membership' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin(_request)
    if (authError) return authError
    const { tenant, error } = await requireTenant(_request)
    if (error || !tenant) return error!

    const { id } = await params
    const existing = await membershipsCollection.findById(id)
    if (!existing || !belongsToTenant(existing, tenant.id)) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const result = await deleteMembershipAndReleaseCard(id)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      message: result.cardReturnedToStock
        ? `Membership deleted. Card #${result.cardNumber} is back in stock.`
        : 'Membership deleted.',
      cardNumber: result.cardNumber,
      cardReturnedToStock: result.cardReturnedToStock,
    })
  } catch (error) {
    console.error('Error deleting membership:', error)
    return NextResponse.json({ error: 'Failed to delete membership' }, { status: 500 })
  }
}
