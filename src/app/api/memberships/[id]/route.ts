import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const membership = await prisma.membership.findUnique({
      where: { id },
      include: {
        member: true,
        membershipNumber: true,
        subscriptionPlan: true,
        cardIssuance: true,
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    return NextResponse.json(membership)
  } catch (error) {
    console.error('Error fetching membership:', error)
    return NextResponse.json({ error: 'Failed to fetch membership' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const existingMembership = await prisma.membership.findUnique({ where: { id } })
    if (!existingMembership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    const allowedUpdates = ['status', 'notes']
    const updateData: Record<string, unknown> = {}
    
    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updateData[key] = body[key]
      }
    }
    
    const membership = await prisma.membership.update({
      where: { id },
      data: updateData,
      include: {
        member: true,
        membershipNumber: true,
        subscriptionPlan: true,
        cardIssuance: true,
      }
    })
    
    return NextResponse.json(membership)
  } catch (error) {
    console.error('Error updating membership:', error)
    return NextResponse.json({ error: 'Failed to update membership' }, { status: 500 })
  }
}
