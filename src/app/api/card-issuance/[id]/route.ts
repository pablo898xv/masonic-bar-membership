import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cardIssuanceUpdateSchema } from '@/lib/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const issuance = await prisma.cardIssuance.findUnique({
      where: { id },
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
    
    if (!issuance) {
      return NextResponse.json({ error: 'Card issuance not found' }, { status: 404 })
    }
    
    return NextResponse.json(issuance)
  } catch (error) {
    console.error('Error fetching card issuance:', error)
    return NextResponse.json({ error: 'Failed to fetch card issuance' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const validation = cardIssuanceUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const existingIssuance = await prisma.cardIssuance.findUnique({ 
      where: { id },
      include: { membership: true }
    })
    
    if (!existingIssuance) {
      return NextResponse.json({ error: 'Card issuance not found' }, { status: 404 })
    }
    
    const updateData: Record<string, unknown> = {
      queueStatus: validation.data.queueStatus,
    }
    
    if (validation.data.notes !== undefined) {
      updateData.notes = validation.data.notes
    }
    
    if (validation.data.queueStatus === 'ENCODED' && !existingIssuance.encodedAt) {
      updateData.encodedAt = new Date()
    }
    
    if (validation.data.queueStatus === 'ISSUED' && !existingIssuance.issuedAt) {
      updateData.issuedAt = new Date()
    }
    
    const issuance = await prisma.cardIssuance.update({
      where: { id },
      data: updateData,
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
    
    if (validation.data.queueStatus === 'ISSUED') {
      await prisma.membership.update({
        where: { id: existingIssuance.membershipId },
        data: { status: 'ACTIVE' }
      })
    }
    
    return NextResponse.json(issuance)
  } catch (error) {
    console.error('Error updating card issuance:', error)
    return NextResponse.json({ error: 'Failed to update card issuance' }, { status: 500 })
  }
}
