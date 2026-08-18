import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { tillSystem } from '@/lib/till-system'

/**
 * Check the status of a card in the till system
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const membershipId = searchParams.get('membershipId')
    
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }
    
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        membershipNumber: true,
        member: true,
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    const magstripePrefix = process.env.MAGSTRIPE_PREFIX || ';9998'
    const cardNumber = `${magstripePrefix}${membership.membershipNumber.cardNumber}`
    
    const result = await tillSystem.getCardStatus(cardNumber)
    
    return NextResponse.json({
      membershipId,
      cardNumber,
      membershipStatus: membership.status,
      tillSystemEnabled: membership.tillSystemEnabled,
      tillSystemStatus: result.success ? result.status : 'UNKNOWN',
      tillSystemConfigured: tillSystem.isConfigured(),
      error: result.success ? null : result.error,
    })
  } catch (error) {
    console.error('Error checking till system status:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
