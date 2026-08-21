import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membershipNumbersCollection } from '@/lib/db'
import { formatMagstripeData } from '@/lib/settings'
import { recordEncodedCard } from '@/lib/fulfill-membership'
import { belongsToTenant, issuanceAlreadyCharged, assertCreditsAvailable, requireTenant } from '@/lib/tenancy'
import { isPaidMembershipStatus } from '@/lib/payment-methods'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    const membership = await membershipsCollection.findById(id)
    if (!membership || !belongsToTenant(membership, tenant.id)) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)
    if (!membershipNumber) {
      return NextResponse.json({ error: 'Card number not found' }, { status: 404 })
    }
    const magstripeData = await formatMagstripeData(membershipNumber.cardNumber, tenant.id)
    const addingPhysical = membership.cardType === 'QR_CODE'
    if (!isPaidMembershipStatus(membership.status)) {
      return NextResponse.json(
        { error: 'Complete payment before encoding a card' },
        { status: 400 }
      )
    }
    if (addingPhysical) {
      const alreadyCharged = await issuanceAlreadyCharged(
        tenant.id,
        membership.id,
        'PHYSICAL_CARD',
        membership.membershipNumberId
      )
      if (!alreadyCharged) {
        const credits = await assertCreditsAvailable(tenant.id, 1)
        if (!credits.ok) {
          return NextResponse.json({ error: credits.error }, { status: credits.status })
        }
      }
    }
    return NextResponse.json({ magstripeData, cardNumber: membershipNumber.cardNumber, requiresCredit: addingPhysical })
  } catch (error) {
    console.error('Error preparing card encode:', error)
    return NextResponse.json({ error: 'Failed to prepare encode' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    const membership = await membershipsCollection.findById(id)
    if (!membership || !belongsToTenant(membership, tenant.id)) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const result = await recordEncodedCard(
      id,
      typeof body.encodedBy === 'string' ? body.encodedBy : 'MSRx6',
      typeof body.notes === 'string' ? body.notes : 'Replacement card encoded from membership view'
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error recording encoded card:', error)
    return NextResponse.json({ error: 'Failed to record encoded card' }, { status: 500 })
  }
}
