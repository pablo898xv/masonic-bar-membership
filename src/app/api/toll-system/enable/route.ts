import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { tollSystem } from '@/lib/toll-system'

/**
 * Enable a membership card in the toll system
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
        { error: 'Membership must be ACTIVE before enabling in toll system' },
        { status: 400 }
      )
    }
    
    if (membership.tollSystemEnabled) {
      return NextResponse.json(
        { message: 'Card already enabled in toll system', status: 'ACTIVE' }
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
    
    const result = await tollSystem.enableCard({
      cardNumber,
      memberName: membership.member.name,
      memberEmail: membership.member.email,
      validFrom: membership.startDate,
      validUntil: membership.expiryDate,
      cardType: membership.cardType as 'QR_CODE' | 'PHYSICAL_CARD',
    })
    
    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Failed to enable card in toll system',
        tollSystemConfigured: tollSystem.isConfigured(),
      }, { status: 500 })
    }
    
    await prisma.membership.update({
      where: { id: membershipId },
      data: {
        tollSystemEnabled: true,
        tollSystemEnabledAt: new Date(),
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Card enabled in toll system',
      cardNumber,
      status: result.status,
      tollSystemConfigured: tollSystem.isConfigured(),
    })
  } catch (error) {
    console.error('Error enabling card in toll system:', error)
    return NextResponse.json({ error: 'Failed to enable card' }, { status: 500 })
  }
}
