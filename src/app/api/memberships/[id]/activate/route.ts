import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection } from '@/lib/db'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const membership = await membershipsCollection.findById(id)
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (membership.status !== 'PAID') {
      return NextResponse.json(
        { error: 'Membership must be in PAID status to activate' },
        { status: 400 }
      )
    }

    await fulfillPaidMembership(id)
    
    const result = await membershipsCollection.findByIdWithRelations(id)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error activating membership:', error)
    return NextResponse.json({ error: 'Failed to activate membership' }, { status: 500 })
  }
}
