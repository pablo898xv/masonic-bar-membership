import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cardNumberImportSchema } from '@/lib/validation'
import { v4 as uuid } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const assigned = searchParams.get('assigned')
    const batchId = searchParams.get('batchId')
    
    const skip = (page - 1) * limit
    
    const where: Record<string, unknown> = {}
    if (assigned === 'true') where.isAssigned = true
    if (assigned === 'false') where.isAssigned = false
    if (batchId) where.batchId = batchId
    
    const [cardNumbers, total, stats] = await Promise.all([
      prisma.membershipNumber.findMany({
        where,
        skip,
        take: limit,
        orderBy: { cardNumber: 'asc' },
        include: {
          membership: {
            include: {
              member: true
            }
          }
        }
      }),
      prisma.membershipNumber.count({ where }),
      prisma.membershipNumber.groupBy({
        by: ['isAssigned'],
        _count: true
      })
    ])
    
    const statsFormatted = {
      total: stats.reduce((acc, s) => acc + s._count, 0),
      assigned: stats.find(s => s.isAssigned)?._count || 0,
      available: stats.find(s => !s.isAssigned)?._count || 0
    }
    
    return NextResponse.json({
      cardNumbers,
      stats: statsFormatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching card numbers:', error)
    return NextResponse.json({ error: 'Failed to fetch card numbers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validation = cardNumberImportSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const { startNumber, endNumber, batchId } = validation.data
    
    if (startNumber > endNumber) {
      return NextResponse.json(
        { error: 'Start number must be less than or equal to end number' },
        { status: 400 }
      )
    }
    
    const maxBatchSize = 10000
    const batchSize = endNumber - startNumber + 1
    if (batchSize > maxBatchSize) {
      return NextResponse.json(
        { error: `Batch size cannot exceed ${maxBatchSize} numbers` },
        { status: 400 }
      )
    }
    
    const existingNumbers = await prisma.membershipNumber.findMany({
      where: {
        cardNumber: {
          gte: startNumber,
          lte: endNumber
        }
      },
      select: { cardNumber: true }
    })
    
    const existingSet = new Set(existingNumbers.map(n => n.cardNumber))
    
    const newNumbers: { id: string; cardNumber: number; batchId: string | null }[] = []
    const importBatchId = batchId || `batch-${Date.now()}`
    
    for (let num = startNumber; num <= endNumber; num++) {
      if (!existingSet.has(num)) {
        newNumbers.push({
          id: uuid(),
          cardNumber: num,
          batchId: importBatchId
        })
      }
    }
    
    if (newNumbers.length === 0) {
      return NextResponse.json(
        { error: 'All numbers in range already exist', existingCount: existingNumbers.length },
        { status: 409 }
      )
    }
    
    await prisma.membershipNumber.createMany({
      data: newNumbers
    })
    
    return NextResponse.json({
      message: `Successfully imported ${newNumbers.length} card numbers`,
      imported: newNumbers.length,
      skipped: existingNumbers.length,
      batchId: importBatchId,
      range: { start: startNumber, end: endNumber }
    }, { status: 201 })
  } catch (error) {
    console.error('Error importing card numbers:', error)
    return NextResponse.json({ error: 'Failed to import card numbers' }, { status: 500 })
  }
}
