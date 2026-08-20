import { NextRequest, NextResponse } from 'next/server'
import { 
  cardIssuancesCollection, 
  membershipsCollection, 
  membershipNumbersCollection 
} from '@/lib/db'
import { tillSystemFor } from '@/lib/till-system'
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
    const { issuedBy, enableTillSystem = true } = body
    
    const issuance = await cardIssuancesCollection.findById(id)
    
    if (!issuance || !belongsToTenant(issuance, tenant.id)) {
      return NextResponse.json({ error: 'Card issuance not found' }, { status: 404 })
    }
    
    if (issuance.queueStatus !== 'ENCODED') {
      return NextResponse.json(
        { error: 'Card must be encoded before issuing' },
        { status: 400 }
      )
    }
    
    const membership = await membershipsCollection.findById(issuance.membershipId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)
    
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

    await cardIssuancesCollection.update(id, {
      queueStatus: 'ISSUED',
      issuedAt: new Date(),
      issuedBy: issuedBy || 'System'
    })
    
    let tillSystemResult = null
    if (enableTillSystem && membershipNumber) {
      try {
        const till = await tillSystemFor(tenant.id)
        tillSystemResult = await till.enableCard({
          cardNumber: membershipNumber.cardNumber.toString(),
          membershipId: membership.id,
          expiryDate: membership.expiryDate!,
          magstripeData: issuance.magstripeData!
        })
        
        if (tillSystemResult.success) {
          await membershipsCollection.update(membership.id, {
            tillSystemEnabled: true,
            tillSystemEnabledAt: new Date()
          })
        }
      } catch (tillError) {
        console.error('Till system enable failed:', tillError)
      }
    }
    
    const updatedIssuance = await cardIssuancesCollection.findById(id)
    
    return NextResponse.json({
      issuance: updatedIssuance,
      tillSystem: tillSystemResult
    })
  } catch (error) {
    console.error('Error issuing card:', error)
    return NextResponse.json({ error: 'Failed to issue card' }, { status: 500 })
  }
}
