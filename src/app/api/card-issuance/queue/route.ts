import { NextResponse } from 'next/server'
import { 
  cardIssuancesCollection, 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection 
} from '@/lib/db'

export async function GET() {
  try {
    const issuances = await cardIssuancesCollection.findByStatuses([
      'PENDING',
      'READY_TO_ENCODE',
      'ENCODED'
    ])
    
    const issuancesWithDetails = await Promise.all(
      issuances.map(async (issuance) => {
        const membership = await membershipsCollection.findById(issuance.membershipId)
        if (!membership) return null
        
        const [member, membershipNumber] = await Promise.all([
          membersCollection.findById(membership.memberId),
          membershipNumbersCollection.findById(membership.membershipNumberId),
        ])
        
        return {
          ...issuance,
          membership,
          member,
          membershipNumber,
          canEncode: issuance.queueStatus === 'READY_TO_ENCODE' && membership.status === 'ACTIVE',
          canIssue: issuance.queueStatus === 'ENCODED',
        }
      })
    )
    
    const validIssuances = issuancesWithDetails.filter(Boolean)
    
    const statusCounts = await cardIssuancesCollection.countByStatus()
    
    return NextResponse.json({
      queue: validIssuances,
      statusCounts,
      total: validIssuances.length
    })
  } catch (error) {
    console.error('Error fetching card queue:', error)
    return NextResponse.json({ error: 'Failed to fetch card queue' }, { status: 500 })
  }
}
