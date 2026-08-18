import { NextRequest, NextResponse } from 'next/server'
import { cardIssuancesCollection, membershipsCollection } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { encodedBy } = body
    
    const issuance = await cardIssuancesCollection.findById(id)
    
    if (!issuance) {
      return NextResponse.json({ error: 'Card issuance not found' }, { status: 404 })
    }
    
    if (issuance.queueStatus !== 'READY_TO_ENCODE') {
      return NextResponse.json(
        { error: 'Card must be in READY_TO_ENCODE status to encode' },
        { status: 400 }
      )
    }
    
    const membership = await membershipsCollection.findById(issuance.membershipId)
    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Associated membership must be active' },
        { status: 400 }
      )
    }
    
    const updatedIssuance = await cardIssuancesCollection.update(id, {
      queueStatus: 'ENCODED',
      encodedAt: new Date(),
      encodedBy: encodedBy || 'System'
    })
    
    return NextResponse.json(updatedIssuance)
  } catch (error) {
    console.error('Error encoding card:', error)
    return NextResponse.json({ error: 'Failed to encode card' }, { status: 500 })
  }
}
