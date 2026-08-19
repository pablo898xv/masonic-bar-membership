import { NextRequest, NextResponse } from 'next/server'
import { membersCollection, membershipsCollection, membershipNumbersCollection, subscriptionPlansCollection, cardIssuancesCollection } from '@/lib/db'
import { memberUpdateSchema } from '@/lib/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const member = await membersCollection.findById(id)
    
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    const { memberships } = await membershipsCollection.findMany({ memberId: id })
    
    const membershipsWithDetails = await Promise.all(
      memberships.map(async (m) => {
        const [membershipNumber, subscriptionPlan, cardIssuance] = await Promise.all([
          membershipNumbersCollection.findById(m.membershipNumberId),
          subscriptionPlansCollection.findById(m.subscriptionPlanId),
          cardIssuancesCollection.findByMembershipId(m.id),
        ])
        return { ...m, membershipNumber, subscriptionPlan, cardIssuance }
      })
    )
    
    return NextResponse.json({ ...member, memberships: membershipsWithDetails })
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
    
    const existingMember = await membersCollection.findById(id)
    if (!existingMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    if (validation.data.email && validation.data.email !== existingMember.email) {
      const emailExists = await membersCollection.findByEmail(validation.data.email)
      if (emailExists) {
        return NextResponse.json(
          { error: 'A member with this email already exists' },
          { status: 409 }
        )
      }
    }
    
    const member = await membersCollection.update(id, validation.data)
    
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
    
    const member = await membersCollection.findById(id)
    
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    
    const { memberships } = await membershipsCollection.findMany({ memberId: id })
    
    if (memberships.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete member while they still have memberships. Delete the memberships first to return cards to stock.' },
        { status: 400 }
      )
    }
    
    await membersCollection.delete(id)
    
    return NextResponse.json({ message: 'Member deleted successfully' })
  } catch (error) {
    console.error('Error deleting member:', error)
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 })
  }
}
