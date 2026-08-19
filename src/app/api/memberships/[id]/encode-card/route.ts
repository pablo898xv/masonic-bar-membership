import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membershipNumbersCollection } from '@/lib/db'
import { formatMagstripeData } from '@/lib/settings'
import { recordEncodedCard } from '@/lib/fulfill-membership'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const membership = await membershipsCollection.findById(id)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)
    if (!membershipNumber) {
      return NextResponse.json({ error: 'Card number not found' }, { status: 404 })
    }
    const magstripeData = await formatMagstripeData(membershipNumber.cardNumber)
    return NextResponse.json({ magstripeData, cardNumber: membershipNumber.cardNumber })
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
    const { id } = await params
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
