import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Mark a card as issued to the member
 * 
 * This endpoint is called when the bar manager has handed over
 * the physical card to the member.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { issuedBy, notes } = body
    
    const issuance = await prisma.cardIssuance.findUnique({
      where: { id },
      include: {
        membership: true
      }
    })
    
    if (!issuance) {
      return NextResponse.json({ error: 'Card issuance not found' }, { status: 404 })
    }
    
    if (issuance.queueStatus !== 'ENCODED') {
      return NextResponse.json(
        { error: `Cannot issue card with status: ${issuance.queueStatus}. Card must be ENCODED first.` },
        { status: 400 }
      )
    }
    
    const [updatedIssuance] = await prisma.$transaction([
      prisma.cardIssuance.update({
        where: { id },
        data: {
          queueStatus: 'ISSUED',
          issuedAt: new Date(),
          issuedBy: issuedBy || null,
          notes: notes || issuance.notes,
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
      }),
      prisma.membership.update({
        where: { id: issuance.membershipId },
        data: { status: 'ACTIVE' }
      })
    ])
    
    return NextResponse.json({
      issuance: updatedIssuance,
      message: 'Card issued to member successfully',
    })
  } catch (error) {
    console.error('Error issuing card:', error)
    return NextResponse.json({ error: 'Failed to issue card' }, { status: 500 })
  }
}
