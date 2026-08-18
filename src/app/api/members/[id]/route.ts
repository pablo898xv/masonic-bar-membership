import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { memberUpdateSchema } from '@/lib/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            membershipNumber: true,
            subscriptionPlan: true,
            cardIssuance: true,
          }
        }
      }
    })
    
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    return NextResponse.json(member)
  } catch (error) {
    console.error('Error fetching member:', error)
    return NextResponse.json({ error: 'Failed to fetch member' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const validation = memberUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const existingMember = await prisma.member.findUnique({ where: { id } })
    if (!existingMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    if (validation.data.email && validation.data.email !== existingMember.email) {
      const emailExists = await prisma.member.findUnique({
        where: { email: validation.data.email }
      })
      if (emailExists) {
        return NextResponse.json(
          { error: 'A member with this email already exists' },
          { status: 409 }
        )
      }
    }
    
    const member = await prisma.member.update({
      where: { id },
      data: validation.data
    })
    
    return NextResponse.json(member)
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const member = await prisma.member.findUnique({
      where: { id },
      include: { memberships: true }
    })
    
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    if (member.memberships.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete member with active memberships' },
        { status: 400 }
      )
    }
    
    await prisma.member.delete({ where: { id } })
    
    return NextResponse.json({ message: 'Member deleted successfully' })
  } catch (error) {
    console.error('Error deleting member:', error)
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 })
  }
}
