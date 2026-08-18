import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { tillSystem } from '@/lib/till-system'

/**
 * Cron job endpoint to check for expired memberships
 * 
 * This should be called periodically (e.g., daily) to:
 * 1. Mark expired memberships as EXPIRED
 * 2. Disable expired cards in the till system
 * 
 * In production, set up a cron job or scheduled task to call this endpoint.
 * You can protect this with a secret key in production.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const now = new Date()
    
    const expiredMemberships = await prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          lt: now
        }
      },
      include: {
        membershipNumber: true,
      }
    })
    
    const results = {
      processed: 0,
      expired: 0,
      tillSystemDisabled: 0,
      errors: [] as string[]
    }
    
    for (const membership of expiredMemberships) {
      results.processed++
      
      try {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: 'EXPIRED' }
        })
        results.expired++
        
        if (membership.tillSystemEnabled) {
          const magstripePrefix = process.env.MAGSTRIPE_PREFIX || ';9998'
          const cardNumber = `${magstripePrefix}${membership.membershipNumber.cardNumber}`
          
          const tillResult = await tillSystem.disableCard(cardNumber, 'Membership expired')
          
          if (tillResult.success) {
            await prisma.membership.update({
              where: { id: membership.id },
              data: { tillSystemEnabled: false }
            })
            results.tillSystemDisabled++
          } else {
            results.errors.push(`Failed to disable till system for membership ${membership.id}: ${tillResult.error}`)
          }
        }
      } catch (error: any) {
        results.errors.push(`Error processing membership ${membership.id}: ${error.message}`)
      }
    }
    
    console.log('Expiry check completed:', results)
    
    return NextResponse.json({
      success: true,
      ...results,
      timestamp: now.toISOString()
    })
  } catch (error) {
    console.error('Error running expiry check:', error)
    return NextResponse.json({ error: 'Failed to run expiry check' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to run the expiry check',
    hint: 'Set CRON_SECRET env var and pass it as Bearer token for production use'
  })
}
