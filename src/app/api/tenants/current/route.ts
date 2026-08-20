import { NextRequest, NextResponse } from 'next/server'
import { tenantsCollection, Tenant } from '@/lib/db'
import { isSuperAdmin, requireAdmin } from '@/lib/auth'
import {
  ensureUserCanAccessTenant,
  requireTenant,
  serializeVenue,
  tenantCookie,
  userTenants,
} from '@/lib/tenancy'

function venuePaymentFields(tenant: Tenant) {
  return {
    bankAccountName: tenant.bankAccountName || '',
    bankSortCode: tenant.bankSortCode || '',
    bankAccountNumberSet: Boolean(tenant.bankAccountNumber),
    magstripePrefix: tenant.magstripePrefix || ';9998',
    tillSystemApiUrl: tenant.tillSystemApiUrl || '',
    tillSystemApiKeySet: Boolean(tenant.tillSystemApiKey),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const allowed = await ensureUserCanAccessTenant(user.id, tenant.id)
    if (!allowed) {
      const fallback = (await userTenants(user.id, isSuperAdmin(user)))[0]
      if (!fallback) {
        return NextResponse.json({ error: 'No venue access' }, { status: 403 })
      }
      const response = NextResponse.json({
        tenant: {
          ...serializeVenue(fallback),
          ...venuePaymentFields(fallback),
        },
      })
      return tenantCookie(response, fallback)
    }

    return NextResponse.json({
      tenant: {
        ...serializeVenue(tenant),
        ...venuePaymentFields(tenant),
      },
    })
  } catch (error) {
    console.error('Error loading current tenant:', error)
    return NextResponse.json({ error: 'Failed to load venue' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request)
    if (error || !user) return error!

    const body = await request.json()
    const tenant = await tenantsCollection.findById(body.tenantId)
    if (!tenant) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }
    const response = NextResponse.json({ ok: true, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } })
    return tenantCookie(response, tenant)
  } catch (error) {
    console.error('Error switching tenant:', error)
    return NextResponse.json({ error: 'Failed to switch venue' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const body = await request.json()
    const patch: Partial<Tenant> = {}
    if (body.name) patch.name = String(body.name)
    if (body.paymentMode === 'OWN' || body.paymentMode === 'PLATFORM') patch.paymentMode = body.paymentMode
    if (typeof body.bankAccountName === 'string') patch.bankAccountName = body.bankAccountName
    if (typeof body.bankSortCode === 'string') patch.bankSortCode = body.bankSortCode.replace(/\D/g, '')
    if (typeof body.bankAccountNumber === 'string' && body.bankAccountNumber) {
      patch.bankAccountNumber = body.bankAccountNumber.replace(/\D/g, '')
    }
    if (typeof body.magstripePrefix === 'string') patch.magstripePrefix = body.magstripePrefix.trim() || ';9998'
    if (typeof body.tillSystemApiUrl === 'string') patch.tillSystemApiUrl = body.tillSystemApiUrl.trim()
    if (typeof body.tillSystemApiKey === 'string' && body.tillSystemApiKey) patch.tillSystemApiKey = body.tillSystemApiKey

    const updated = await tenantsCollection.update(tenant.id, patch)
    return NextResponse.json({
      tenant: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        paymentMode: updated.paymentMode,
        ...venuePaymentFields(updated),
      },
    })
  } catch (error) {
    console.error('Error updating tenant:', error)
    return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 })
  }
}
