import { NextRequest, NextResponse } from 'next/server'
import { enableCardFormat } from '@/lib/fulfill-membership'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const format = body.format === 'PHYSICAL_CARD' ? 'PHYSICAL_CARD' : body.format === 'QR_CODE' ? 'QR_CODE' : null
    if (!format) {
      return NextResponse.json({ error: 'format must be QR_CODE or PHYSICAL_CARD' }, { status: 400 })
    }

    const result = await enableCardFormat(id, format)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error enabling card format:', error)
    return NextResponse.json({ error: 'Failed to issue card format' }, { status: 500 })
  }
}
