import { NextRequest, NextResponse } from 'next/server'
import { tenantsCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { clearTenantLogo, saveTenantLogo } from '@/lib/branding'
import { ensureUserCanAccessTenant, requireTenant, serializeVenue } from '@/lib/tenancy'

async function loadTarget(request: NextRequest, id: string) {
  const { user, error } = await requireAdmin(request)
  if (error || !user) return { error: error!, tenant: null }

  if (id === 'current') {
    const resolved = await requireTenant(request)
    if (resolved.error || !resolved.tenant) {
      return { error: resolved.error || NextResponse.json({ error: 'Venue not found' }, { status: 404 }), tenant: null }
    }
    if (!(await ensureUserCanAccessTenant(user.id, resolved.tenant.id))) {
      return {
        error: NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 }),
        tenant: null,
      }
    }
    return { error: null as NextResponse | null, tenant: resolved.tenant }
  }

  const tenant = await tenantsCollection.findById(id)
  if (!tenant) {
    return { error: NextResponse.json({ error: 'Venue not found' }, { status: 404 }), tenant: null }
  }
  if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
    return {
      error: NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 }),
      tenant: null,
    }
  }
  return { error: null as NextResponse | null, tenant }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const loaded = await loadTarget(request, id)
    if (loaded.error || !loaded.tenant) return loaded.error!

    const body = (await request.json()) as { logoPng?: string; iconPng?: string }
    if (!body.logoPng) {
      return NextResponse.json({ error: 'Choose a logo image' }, { status: 400 })
    }

    const updated = await saveTenantLogo(loaded.tenant.id, body.logoPng, body.iconPng)
    return NextResponse.json({ tenant: serializeVenue(updated) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save logo'
    const status = /PNG|large|required/i.test(message) ? 400 : 500
    console.error('Error saving venue logo', error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const loaded = await loadTarget(request, id)
    if (loaded.error || !loaded.tenant) return loaded.error!

    const updated = await clearTenantLogo(loaded.tenant.id)
    return NextResponse.json({ tenant: serializeVenue(updated) })
  } catch (error) {
    console.error('Error removing venue logo', error)
    return NextResponse.json({ error: 'Failed to remove logo' }, { status: 500 })
  }
}
