import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const availableNumber = await prisma.membershipNumber.findFirst({
      where: { isAssigned: false },
      orderBy: { cardNumber: 'asc' }
    })
    
    if (!availableNumber) {
      return NextResponse.json(
        { error: 'No available card numbers. Please import more numbers.' },
        { status: 404 }
      )
    }
    
    const totalAvailable = await prisma.membershipNumber.count({
      where: { isAssigned: false }
    })
    
    return NextResponse.json({
      nextAvailable: availableNumber,
      totalAvailable
    })
  } catch (error) {
    console.error('Error fetching available card number:', error)
    return NextResponse.json({ error: 'Failed to fetch available card number' }, { status: 500 })
  }
}
