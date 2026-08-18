import { NextResponse } from 'next/server'
import { membershipNumbersCollection } from '@/lib/db'

export async function GET() {
  try {
    const availableNumber = await membershipNumbersCollection.findFirstAvailable()
    
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
