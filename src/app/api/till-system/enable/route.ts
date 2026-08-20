import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membershipNumbersCollection, cardIssuancesCollection } from '@/lib/db'
import { tillSystemFor } from '@/lib/till-system'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipId } = body
    
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }
    
    const membership = await membershipsCollection.findById(membershipId)
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (membership.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Membership must be active to enable in till system' },
        { status: 400 }
      )
    }
    
    const [membershipNumber, cardIssuance] = await Promise.all([
      membershipNumbersCollection.findById(membership.membershipNumberId),
      cardIssuancesCollection.findByMembershipId(membershipId),
    ])
    
    if (!membershipNumber) {
      return NextResponse.json({ error: 'Membership number not found' }, { status: 404 })
    }
    
    const till = await tillSystemFor(membership.tenantId)
    const result = await till.enableCard({
      cardNumber: membershipNumber.cardNumber.toString(),
      membershipId: membership.id,
      expiryDate: membership.expiryDate!,
      magstripeData: cardIssuance?.magstripeData
    })
    
    if (result.success) {
      await membershipsCollection.update(membershipId, {
        tillSystemEnabled: true,
        tillSystemEnabledAt: new Date()
      })
    }
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      tillSystemEnabled: result.success
    })
  } catch (error) {
    console.error('Error enabling card in till system:', error)
    return NextResponse.json({ error: 'Failed to enable card in till system' }, { status: 500 })
  }
}
