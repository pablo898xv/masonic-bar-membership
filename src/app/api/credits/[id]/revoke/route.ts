import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { requireTenant, revokeCreditPack } from '@/lib/tenancy'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requirePlatformAdmin(request)
    if (authError || !user) return authError!
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    const result = await revokeCreditPack(tenant.id, id, user.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error revoking credit pack:', error)
    return NextResponse.json({ error: 'Failed to revoke pack' }, { status: 500 })
  }
}
