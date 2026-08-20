import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection } from '@/lib/db'
import { fulfillPaidMembership } from '@/lib/fulfill-membership'
import { belongsToTenant, creditsErrorResponse, requireTenant } from '@/lib/tenancy'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    
    const membership = await membershipsCollection.findById(id)
    
    if (!membership || !belongsToTenant(membership, tenant.id)) {
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
    const credits = creditsErrorResponse(error)
    if (credits) return credits
    console.error('Error activating membership:', error)
    return NextResponse.json({ error: 'Failed to activate membership' }, { status: 500 })
  }
}
