import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection } from '@/lib/db'
import { deleteMembershipAndReleaseCard } from '@/lib/delete-membership'
import { formatMagstripeData } from '@/lib/settings'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const result = await membershipsCollection.findByIdWithRelations(id)
    
    if (!result) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...result.membership,
      member: result.member,
      membershipNumber: result.membershipNumber,
      subscriptionPlan: result.subscriptionPlan,
      cardIssuance: result.cardIssuance || null,
      magstripeData: await formatMagstripeData(result.membershipNumber.cardNumber),
      digitalCardPath: result.membership.accessToken
        ? `/membership/card/${result.membership.id}?token=${encodeURIComponent(result.membership.accessToken)}`
        : null,
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
    const { id } = await params
    const body = await request.json()
    
    const existingMembership = await membershipsCollection.findById(id)
    if (!existingMembership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    const allowedFields = ['status', 'notes']
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
    const { id } = await params
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
