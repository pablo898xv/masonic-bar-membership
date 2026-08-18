import { NextRequest, NextResponse } from 'next/server'
import { 
  cardIssuancesCollection, 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection 
} from '@/lib/db'
import { cardIssuanceUpdateSchema } from '@/lib/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const issuance = await cardIssuancesCollection.findById(id)
    
    if (!issuance) {
      return NextResponse.json({ error: 'Card issuance not found' }, { status: 404 })
    }
    
    const membership = await membershipsCollection.findById(issuance.membershipId)
    if (!membership) {
      return NextResponse.json({ error: 'Related membership not found' }, { status: 404 })
    }
    
    const [member, membershipNumber] = await Promise.all([
      membersCollection.findById(membership.memberId),
      membershipNumbersCollection.findById(membership.membershipNumberId),
    ])
    
    return NextResponse.json({ ...issuance, membership, member, membershipNumber })
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
    
    const existingIssuance = await cardIssuancesCollection.findById(id)
    if (!existingIssuance) {
      return NextResponse.json({ error: 'Card issuance not found' }, { status: 404 })
    }
    
    const issuance = await cardIssuancesCollection.update(id, validation.data)
    
    return NextResponse.json(issuance)
  } catch (error) {
    console.error('Error updating card issuance:', error)
    return NextResponse.json({ error: 'Failed to update card issuance' }, { status: 500 })
  }
}
