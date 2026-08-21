import { NextRequest, NextResponse } from 'next/server'
import { tenantApiKeysCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { belongsToTenant, ensureUserCanAccessTenant, requireTenant } from '@/lib/tenancy'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const { id } = await params
    const key = await tenantApiKeysCollection.findById(id)
    if (!key || !belongsToTenant(key, tenant.id) || key.revokedAt) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    await tenantApiKeysCollection.update(id, { revokedAt: new Date() })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error revoking API key:', error)
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 })
  }
}
