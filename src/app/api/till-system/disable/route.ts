import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { tillSystem } from '@/lib/till-system'

/**
 * Disable a membership card in the till system
 * 
 * This endpoint should be called when:
 * - A membership expires
 * - A membership is cancelled/refunded
 * - A card is reported lost/stolen
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipId, reason } = body
    
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }
    
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        membershipNumber: true,
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (!membership.tillSystemEnabled) {
      return NextResponse.json(
        { message: 'Card not enabled in till system', status: 'INACTIVE' }
      )
    }
    
    const magstripePrefix = process.env.MAGSTRIPE_PREFIX || ';9998'
    const cardNumber = `${magstripePrefix}${membership.membershipNumber.cardNumber}`
    
    const result = await tillSystem.disableCard(cardNumber, reason)
    
    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Failed to disable card in till system',
        tillSystemConfigured: tillSystem.isConfigured(),
      }, { status: 500 })
    }
    
    await prisma.membership.update({
      where: { id: membershipId },
      data: {
        tillSystemEnabled: false,
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Card disabled in till system',
      cardNumber,
      status: result.status,
      tillSystemConfigured: tillSystem.isConfigured(),
    })
  } catch (error) {
    console.error('Error disabling card in till system:', error)
    return NextResponse.json({ error: 'Failed to disable card' }, { status: 500 })
  }
}
