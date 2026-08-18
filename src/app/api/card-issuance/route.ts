import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    
    const skip = (page - 1) * limit
    
    const where: Record<string, unknown> = {}
    if (status) {
      where.queueStatus = status
    }
    
    const [issuances, total, statusCounts] = await Promise.all([
      prisma.cardIssuance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          membership: {
            include: {
              member: true,
              membershipNumber: true,
              subscriptionPlan: true,
            }
          }
        }
      }),
      prisma.cardIssuance.count({ where }),
      prisma.cardIssuance.groupBy({
        by: ['queueStatus'],
        _count: true
      })
    ])
    
    const stats = {
      pending: 0,
      readyToEncode: 0,
      encoded: 0,
      issued: 0,
      shipped: 0,
    }
    
    statusCounts.forEach(s => {
      switch (s.queueStatus) {
        case 'PENDING': stats.pending = s._count; break
        case 'READY_TO_ENCODE': stats.readyToEncode = s._count; break
        case 'ENCODED': stats.encoded = s._count; break
        case 'ISSUED': stats.issued = s._count; break
        case 'SHIPPED': stats.shipped = s._count; break
      }
    })
    
    return NextResponse.json({
      issuances,
      stats,
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
