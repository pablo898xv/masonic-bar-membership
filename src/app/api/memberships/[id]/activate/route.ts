import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { addYears } from 'date-fns'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const membership = await prisma.membership.findUnique({
      where: { id },
      include: {
        subscriptionPlan: true,
        cardIssuance: true,
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (membership.status !== 'PAID') {
      return NextResponse.json(
        { error: 'Cannot activate membership that is not paid' },
        { status: 400 }
      )
    }
    
    const startDate = new Date()
    const expiryDate = addYears(startDate, membership.subscriptionPlan.durationYears)
    
    const updatedMembership = await prisma.membership.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startDate,
        expiryDate,
      },
      include: {
        member: true,
        membershipNumber: true,
        subscriptionPlan: true,
        cardIssuance: true,
      }
    })
    
    return NextResponse.json({
      membership: updatedMembership,
      message: 'Membership activated successfully'
    })
  } catch (error) {
    console.error('Error activating membership:', error)
    return NextResponse.json({ error: 'Failed to activate membership' }, { status: 500 })
  }
}
