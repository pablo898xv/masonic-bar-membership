import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membershipNumbersCollection } from '@/lib/db'
import tillSystem from '@/lib/till-system'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const membershipId = searchParams.get('membershipId')
    
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
    
    const result = await tillSystem.getCardStatus(membershipNumber.cardNumber.toString())
    
    return NextResponse.json({
      membershipId,
      cardNumber: membershipNumber.cardNumber,
      localStatus: {
        tillSystemEnabled: membership.tillSystemEnabled,
        tillSystemEnabledAt: membership.tillSystemEnabledAt
      },
      remoteStatus: result.success ? result.data : null,
      error: result.success ? null : result.message
    })
  } catch (error) {
    console.error('Error checking till system status:', error)
    return NextResponse.json({ error: 'Failed to check till system status' }, { status: 500 })
  }
}
