import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { addDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const daysAhead = parseInt(searchParams.get('days') || '30')
    
    const now = new Date()
    const futureDate = addDays(now, daysAhead)
    
    const expiringMemberships = await prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          gte: now,
          lte: futureDate
        }
      },
      orderBy: { expiryDate: 'asc' },
      include: {
        member: true,
        membershipNumber: true,
        subscriptionPlan: true,
      }
    })
    
    const expiredMemberships = await prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          lt: now
        }
      },
      orderBy: { expiryDate: 'asc' },
      include: {
        member: true,
        membershipNumber: true,
        subscriptionPlan: true,
      }
    })
    
    return NextResponse.json({
      expiring: expiringMemberships,
      expired: expiredMemberships,
      summary: {
        expiringCount: expiringMemberships.length,
        expiredCount: expiredMemberships.length,
        daysAhead
      }
    })
  } catch (error) {
    console.error('Error fetching expiring memberships:', error)
    return NextResponse.json({ error: 'Failed to fetch expiring memberships' }, { status: 500 })
  }
}
