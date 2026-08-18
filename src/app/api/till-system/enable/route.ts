import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { tillSystem } from '@/lib/till-system'

/**
 * Enable a membership card in the till system
 * 
 * This endpoint should be called after a membership is fully activated:
 * - For QR code cards: After payment is completed
 * - For physical cards: After the card has been issued to the member
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipId } = body
    
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }
    
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        member: true,
        membershipNumber: true,
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (membership.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Membership must be ACTIVE before enabling in till system' },
        { status: 400 }
      )
    }
    
    if (membership.tillSystemEnabled) {
      return NextResponse.json(
        { message: 'Card already enabled in till system', status: 'ACTIVE' }
      )
    }
    
    if (!membership.startDate || !membership.expiryDate) {
      return NextResponse.json(
        { error: 'Membership dates not set' },
        { status: 400 }
      )
    }
    
    const magstripePrefix = process.env.MAGSTRIPE_PREFIX || ';9998'
    const cardNumber = `${magstripePrefix}${membership.membershipNumber.cardNumber}`
    
    const result = await tillSystem.enableCard({
      cardNumber,
      memberName: membership.member.name,
      memberEmail: membership.member.email,
      validFrom: membership.startDate,
      validUntil: membership.expiryDate,
      cardType: membership.cardType as 'QR_CODE' | 'PHYSICAL_CARD',
    })
    
    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Failed to enable card in till system',
        tillSystemConfigured: tillSystem.isConfigured(),
      }, { status: 500 })
    }
    
    await prisma.membership.update({
      where: { id: membershipId },
      data: {
        tillSystemEnabled: true,
        tillSystemEnabledAt: new Date(),
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Card enabled in till system',
      cardNumber,
      status: result.status,
      tillSystemConfigured: tillSystem.isConfigured(),
    })
  } catch (error) {
    console.error('Error enabling card in till system:', error)
    return NextResponse.json({ error: 'Failed to enable card' }, { status: 500 })
  }
}
