import { NextRequest, NextResponse } from 'next/server'
import { 
  cardIssuancesCollection, 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection 
} from '@/lib/db'
import { requireTenant } from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || undefined
    
    const { issuances, total } = await cardIssuancesCollection.findMany({
      tenantId: tenant.id,
      queueStatus: status,
      take: limit,
    })
    
    const issuancesWithDetails = await Promise.all(
      issuances.map(async (issuance) => {
        const membership = await membershipsCollection.findById(issuance.membershipId)
        if (!membership) return { ...issuance, membership: null, member: null, membershipNumber: null }
        
        const [member, membershipNumber] = await Promise.all([
          membersCollection.findById(membership.memberId),
          membershipNumbersCollection.findById(membership.membershipNumberId),
        ])
        
        return { ...issuance, membership, member, membershipNumber }
      })
    )
    
    const statusCounts = await cardIssuancesCollection.countByStatus(tenant.id)
    
    return NextResponse.json({
      issuances: issuancesWithDetails,
      statusCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching card issuances:', error)
    return NextResponse.json({ error: 'Failed to fetch card issuances' }, { status: 500 })
  }
}
