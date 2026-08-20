import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membershipNumbersCollection } from '@/lib/db'
import { tillSystemFor } from '@/lib/till-system'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipId, reason } = body
    
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }
    
    const membership = await membershipsCollection.findById(membershipId)
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)
    
    if (!membershipNumber) {
      return NextResponse.json({ error: 'Membership number not found' }, { status: 404 })
    }
    
    const till = await tillSystemFor(membership.tenantId)
    const result = await till.disableCard({
      cardNumber: membershipNumber.cardNumber.toString(),
      reason: reason || 'Manual disable'
    })
    
    if (result.success) {
      await membershipsCollection.update(membershipId, {
        tillSystemEnabled: false
      })
    }
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      tillSystemEnabled: false
    })
  } catch (error) {
    console.error('Error disabling card in till system:', error)
    return NextResponse.json({ error: 'Failed to disable card in till system' }, { status: 500 })
  }
}
