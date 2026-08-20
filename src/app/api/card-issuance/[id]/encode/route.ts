import { NextRequest, NextResponse } from 'next/server'
import { cardIssuancesCollection, membershipsCollection } from '@/lib/db'
import { belongsToTenant, consumeIssuanceCredit, requireTenant } from '@/lib/tenancy'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    const body = await request.json()
    const { encodedBy, notes } = body
    
    const issuance = await cardIssuancesCollection.findById(id)
    
    if (!issuance || !belongsToTenant(issuance, tenant.id)) {
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

    if (membership.cardType === 'QR_CODE') {
      const charged = await consumeIssuanceCredit(
        membership.tenantId,
        membership.id,
        'PHYSICAL_CARD',
        undefined,
        membership.membershipNumberId
      )
      if (!charged.ok) {
        return NextResponse.json({ error: charged.error }, { status: charged.status })
      }
      await membershipsCollection.update(membership.id, { cardType: 'BOTH' })
    }

    const updatedIssuance = await cardIssuancesCollection.update(id, {
      queueStatus: 'ENCODED',
      encodedAt: new Date(),
      encodedBy: encodedBy || 'System',
      ...(typeof notes === 'string' && notes ? { notes } : {}),
    })

    return NextResponse.json(updatedIssuance)
  } catch (error) {
    console.error('Error encoding card:', error)
    return NextResponse.json({ error: 'Failed to encode card' }, { status: 500 })
  }
}
