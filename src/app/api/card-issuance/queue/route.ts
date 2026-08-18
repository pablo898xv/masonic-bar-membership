import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Get the card issuance queue for the bar manager
 * 
 * Returns cards that need to be processed, ordered by priority:
 * 1. READY_TO_ENCODE - Cards that need to be encoded with magstripe writer
 * 2. ENCODED - Cards ready to be issued to members
 * 3. PENDING - Cards waiting for payment to complete
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeCompleted = searchParams.get('includeCompleted') === 'true'
    
    const statusOrder = ['READY_TO_ENCODE', 'ENCODED', 'PENDING']
    if (includeCompleted) {
      statusOrder.push('ISSUED', 'SHIPPED')
    }
    
    const issuances = await prisma.cardIssuance.findMany({
      where: {
        queueStatus: {
          in: statusOrder
        }
      },
      orderBy: [
        { createdAt: 'asc' }
      ],
      include: {
        membership: {
          include: {
            member: true,
            membershipNumber: true,
            subscriptionPlan: true,
          }
        }
      }
    })
    
    const grouped = {
      readyToEncode: issuances.filter(i => i.queueStatus === 'READY_TO_ENCODE'),
      encoded: issuances.filter(i => i.queueStatus === 'ENCODED'),
      pending: issuances.filter(i => i.queueStatus === 'PENDING'),
      issued: includeCompleted ? issuances.filter(i => i.queueStatus === 'ISSUED') : [],
      shipped: includeCompleted ? issuances.filter(i => i.queueStatus === 'SHIPPED') : [],
    }
    
    const summary = {
      total: issuances.length,
      readyToEncode: grouped.readyToEncode.length,
      encoded: grouped.encoded.length,
      pending: grouped.pending.length,
      actionRequired: grouped.readyToEncode.length + grouped.encoded.length,
    }
    
    const magstripePrefix = process.env.MAGSTRIPE_PREFIX || ';9998'
    
    return NextResponse.json({
      queue: grouped,
      summary,
      encodingInstructions: {
        prefix: magstripePrefix,
        format: 'Track 1: {prefix}{cardNumber}',
        example: `${magstripePrefix}1500`,
        note: 'Card number is printed on the back of each physical card',
      }
    })
  } catch (error) {
    console.error('Error fetching card issuance queue:', error)
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }
}
