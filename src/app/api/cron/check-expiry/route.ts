import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membershipNumbersCollection } from '@/lib/db'
import tillSystem from '@/lib/till-system'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const expiredMemberships = await membershipsCollection.findExpired()
    
    const results = {
      processed: 0,
      expired: 0,
      tillSystemDisabled: 0,
      errors: [] as string[]
    }
    
    for (const membership of expiredMemberships) {
      results.processed++
      
      try {
        await membershipsCollection.update(membership.id, {
          status: 'EXPIRED'
        })
        results.expired++
        
        if (membership.tillSystemEnabled) {
          const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)
          
          if (membershipNumber) {
            try {
              const tillResult = await tillSystem.disableCard({
                cardNumber: membershipNumber.cardNumber.toString(),
                reason: 'Membership expired'
              })
              
              if (tillResult.success) {
                await membershipsCollection.update(membership.id, {
                  tillSystemEnabled: false
                })
                results.tillSystemDisabled++
              }
            } catch (tillError) {
              results.errors.push(`Till system disable failed for ${membership.id}: ${tillError}`)
            }
          }
        }
      } catch (error) {
        results.errors.push(`Failed to process membership ${membership.id}: ${error}`)
      }
    }
    
    return NextResponse.json({
      message: 'Expiry check completed',
      results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error running expiry check:', error)
    return NextResponse.json({ error: 'Failed to run expiry check' }, { status: 500 })
  }
}
