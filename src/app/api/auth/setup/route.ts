import { NextResponse } from 'next/server'
import { adminUsersCollection } from '@/lib/db'

export async function GET() {
  try {
    const count = await adminUsersCollection.count()
    return NextResponse.json({ needsSetup: count === 0 })
  } catch (error) {
    console.error('Error checking auth setup:', error)
    return NextResponse.json({ error: 'Failed to check setup' }, { status: 500 })
  }
}
