import { NextRequest, NextResponse } from 'next/server'
import { membershipNumbersCollection } from '@/lib/db'
import { requireTenant } from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const availableNumber = await membershipNumbersCollection.findFirstAvailable(tenant.id)
    
    if (!availableNumber) {
      return NextResponse.json(
        { error: 'No available card numbers. Please import more numbers.' },
        { status: 404 }
      )
    }
    
    const totalAvailable = await membershipNumbersCollection.countAvailable()
    
    return NextResponse.json({
      nextAvailable: availableNumber,
      totalAvailable
    })
  } catch (error) {
    console.error('Error fetching available card number:', error)
    return NextResponse.json({ error: 'Failed to fetch available card number' }, { status: 500 })
  }
}
