import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection, 
  subscriptionPlansCollection 
} from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const includeExpired = searchParams.get('includeExpired') === 'true'
    
    let memberships = await membershipsCollection.findExpiring(days)
    
    if (includeExpired) {
      const expiredMemberships = await membershipsCollection.findExpired()
      memberships = [...expiredMemberships, ...memberships]
    }
    
    const membershipsWithDetails = await Promise.all(
      memberships.map(async (m) => {
        const [member, membershipNumber, subscriptionPlan] = await Promise.all([
          membersCollection.findById(m.memberId),
          membershipNumbersCollection.findById(m.membershipNumberId),
          subscriptionPlansCollection.findById(m.subscriptionPlanId),
        ])
        
        const daysUntilExpiry = m.expiryDate 
          ? Math.ceil((m.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null
        
        return {
          ...m,
          member,
          membershipNumber,
          subscriptionPlan,
          daysUntilExpiry,
          isExpired: daysUntilExpiry !== null && daysUntilExpiry < 0
        }
      })
    )
    
    return NextResponse.json({
      memberships: membershipsWithDetails,
      total: membershipsWithDetails.length,
      criteria: {
        days,
        includeExpired
      }
    })
  } catch (error) {
    console.error('Error fetching expiring memberships:', error)
    return NextResponse.json({ error: 'Failed to fetch expiring memberships' }, { status: 500 })
  }
}
