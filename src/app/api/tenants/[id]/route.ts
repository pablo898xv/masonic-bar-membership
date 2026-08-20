import { NextRequest, NextResponse } from 'next/server'
import { tenantsCollection } from '@/lib/db'
import { requireAdmin, requirePlatformAdmin } from '@/lib/auth'
import {
  applyVenueIdentity,
  deleteTenant,
  ensureUserCanAccessTenant,
  serializeVenue,
  TENANT_COOKIE,
  tenantCookie,
} from '@/lib/tenancy'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request)
    if (error || !user) return error!

    const { id } = await params
    const tenant = await tenantsCollection.findById(id)
    if (!tenant) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }
    return NextResponse.json({ tenant: serializeVenue(tenant) })
  } catch (error) {
    console.error('Error loading venue:', error)
    return NextResponse.json({ error: 'Failed to load venue' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request)
    if (error || !user) return error!

    const { id } = await params
    const tenant = await tenantsCollection.findById(id)
    if (!tenant) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const body = await request.json()
    const result = await applyVenueIdentity(body, tenant)
    if (result.error || !result.patch) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const updated = await tenantsCollection.update(id, result.patch)
    const response = NextResponse.json({ tenant: serializeVenue(updated) })
    const current = request.cookies.get(TENANT_COOKIE)?.value
    if (current === id) {
      return tenantCookie(response, updated)
    }
    return response
  } catch (error) {
    console.error('Error updating venue:', error)
    return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePlatformAdmin(request)
    if (error) return error

    const { id } = await params
    const result = await deleteTenant(id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const response = NextResponse.json({ ok: true, deletedId: id })
    const current = request.cookies.get(TENANT_COOKIE)?.value
    if (result.fallback && (!current || current === id)) {
      return tenantCookie(response, result.fallback)
    }
    return response
  } catch (error) {
    console.error('Error deleting venue:', error)
    return NextResponse.json({ error: 'Failed to delete venue' }, { status: 500 })
  }
}
