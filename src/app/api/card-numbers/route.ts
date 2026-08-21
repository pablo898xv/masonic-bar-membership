import { NextRequest, NextResponse } from 'next/server'
import {
  membershipNumbersCollection,
  membershipsCollection,
  membersCollection,
  cardIssuancesCollection,
} from '@/lib/db'
import { cardNumberImportSchema } from '@/lib/validation'
import { formatMagstripeData, getMagstripePrefix } from '@/lib/settings'
import { isPaidMembershipStatus } from '@/lib/payment-methods'
import { requireTenant } from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const assigned = searchParams.get('assigned')
    const batchId = searchParams.get('batchId')
    
    const { numbers, total, stats } = await membershipNumbersCollection.findMany({
      tenantId: tenant.id,
      assigned: assigned === 'true' ? true : assigned === 'false' ? false : undefined,
      batchId: batchId || undefined,
      skip: (Math.max(1, page) - 1) * limit,
      take: limit,
    })

    const magstripePrefix = await getMagstripePrefix(tenant.id)
    const cardNumbers = await Promise.all(
      numbers.map(async (number) => {
        const magstripeData = await formatMagstripeData(number.cardNumber, tenant.id)
        if (!number.isAssigned) {
          return { ...number, magstripeData, canEncode: true, membership: null, cardIssuance: null }
        }

        const linked = await membershipsCollection.findByMembershipNumberId(number.id)
        const membership =
          linked.find((item) => item.status === 'ACTIVE') ||
          linked.find((item) => item.status === 'PAID') ||
          linked[0] ||
          null

        if (!membership) {
          return { ...number, magstripeData, canEncode: true, membership: null, cardIssuance: null }
        }

        const [member, cardIssuance] = await Promise.all([
          membersCollection.findById(membership.memberId),
          cardIssuancesCollection.findByMembershipId(membership.id),
        ])

        const paid = isPaidMembershipStatus(membership.status)
        const canEncode = paid && (cardIssuance?.queueStatus !== 'PENDING')

        return {
          ...number,
          magstripeData: canEncode ? magstripeData : '',
          canEncode,
          membership: member
            ? { id: membership.id, status: membership.status, cardType: membership.cardType, member }
            : null,
          cardIssuance: cardIssuance
            ? { id: cardIssuance.id, queueStatus: cardIssuance.queueStatus }
            : null,
        }
      })
    )
    
    return NextResponse.json({
      cardNumbers,
      magstripePrefix,
      stats,
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
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

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
    
    const existingNumbers = await membershipNumbersCollection.findInRange(startNumber, endNumber)
    const existingSet = new Set(
      existingNumbers.filter((number) => number.tenantId === tenant.id).map((n) => n.cardNumber)
    )
    
    const newNumbers: Array<{ cardNumber: number; batchId?: string }> = []
    const importBatchId = batchId || `batch-${Date.now()}`
    
    for (let num = startNumber; num <= endNumber; num++) {
      if (!existingSet.has(num)) {
        newNumbers.push({
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
    
    await membershipNumbersCollection.createMany(newNumbers, tenant.id)
    
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
