import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { tollSystem } from '@/lib/toll-system'

/**
 * Check the status of a card in the toll system
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
    
    const result = await tollSystem.getCardStatus(cardNumber)
    
    return NextResponse.json({
      membershipId,
      cardNumber,
      membershipStatus: membership.status,
      tollSystemEnabled: membership.tollSystemEnabled,
      tollSystemStatus: result.success ? result.status : 'UNKNOWN',
      tollSystemConfigured: tollSystem.isConfigured(),
      error: result.success ? null : result.error,
    })
  } catch (error) {
    console.error('Error checking toll system status:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
