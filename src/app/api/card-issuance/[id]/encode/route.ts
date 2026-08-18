import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Mark a card as encoded by the bar manager
 * 
 * This endpoint is called when the bar manager has used the card writer
 * to encode the magstripe data onto a physical card.
 * 
 * The magstripe data format is: PREFIX + CARD_NUMBER
 * Example: ";9998" + "1500" = ";99981500"
 * 
 * Track 1 data should be written as provided in the magstripeData field.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { encodedBy } = body
    
    const issuance = await prisma.cardIssuance.findUnique({
      where: { id },
      include: {
        membership: {
          include: {
            membershipNumber: true,
          }
        }
      }
    })
    
    if (!issuance) {
      return NextResponse.json({ error: 'Card issuance not found' }, { status: 404 })
    }
    
    if (issuance.queueStatus !== 'READY_TO_ENCODE') {
      return NextResponse.json(
        { error: `Cannot encode card with status: ${issuance.queueStatus}. Card must be READY_TO_ENCODE.` },
        { status: 400 }
      )
    }
    
    const updatedIssuance = await prisma.cardIssuance.update({
      where: { id },
      data: {
        queueStatus: 'ENCODED',
        encodedAt: new Date(),
        encodedBy: encodedBy || null,
      },
      include: {
        membership: {
          include: {
            member: true,
            membershipNumber: true,
            subscriptionPlan: true,
          }
        }
      }
    })
    
    return NextResponse.json({
      issuance: updatedIssuance,
      message: 'Card marked as encoded',
      magstripeData: updatedIssuance.magstripeData,
      cardNumber: issuance.membership.membershipNumber.cardNumber,
    })
  } catch (error) {
    console.error('Error encoding card:', error)
    return NextResponse.json({ error: 'Failed to mark card as encoded' }, { status: 500 })
  }
}
