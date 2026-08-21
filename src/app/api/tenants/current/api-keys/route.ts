import { NextRequest, NextResponse } from 'next/server'
import { tenantApiKeysCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ensureUserCanAccessTenant, requireTenant } from '@/lib/tenancy'
import { generatePartnerApiKey, serializeApiKey } from '@/lib/partner-auth'

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const keys = await tenantApiKeysCollection.findByTenant(tenant.id)
    return NextResponse.json({
      keys: keys.filter((key) => !key.revokedAt).map(serializeApiKey),
      issueUrl: '/api/v1/memberships',
      plansUrl: '/api/v1/plans',
    })
  } catch (error) {
    console.error('Error listing API keys:', error)
    return NextResponse.json({ error: 'Failed to load API keys' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Partner API key'
    const generated = generatePartnerApiKey()
    const row = await tenantApiKeysCollection.create({
      tenantId: tenant.id,
      name,
      keyPrefix: generated.prefix,
      keyHash: generated.keyHash,
      createdByUserId: user.id,
    })

    return NextResponse.json(
      {
        key: serializeApiKey(row),
        secret: generated.key,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}
