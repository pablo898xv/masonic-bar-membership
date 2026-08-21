import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { sendDigitalCardEmail } from '@/lib/fulfill-membership'
import { belongsToTenant, requireTenant } from '@/lib/tenancy'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin(_request)
    if (authError) return authError
    const { tenant, error } = await requireTenant(_request)
    if (error || !tenant) return error!

    const { id } = await params
    const membership = await membershipsCollection.findById(id)
    if (!membership || !belongsToTenant(membership, tenant.id)) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const result = await sendDigitalCardEmail(id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      to: result.to,
    })
  } catch (error) {
    console.error('Error sending digital card email', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
