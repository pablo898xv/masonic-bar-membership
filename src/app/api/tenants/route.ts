import { NextRequest, NextResponse } from 'next/server'
import { tenantsCollection, tenantUsersCollection, subscriptionPlansCollection } from '@/lib/db'
import { isSuperAdmin, requireAdmin, requirePlatformAdmin } from '@/lib/auth'
import {
  ensureDefaultTenant,
  serializeVenue,
  slugify,
  tenantCookie,
  userTenants,
  venueDetailsFromBody,
  isReservedUrlStub,
} from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    await ensureDefaultTenant()
    const isPublic = request.nextUrl.searchParams.get('public') === '1'
    if (isPublic) {
      return NextResponse.json({ tenants: [] })
    }

    const { user, error } = await requireAdmin(request)
    if (error || !user) return error!

    const tenants = await userTenants(user.id, isSuperAdmin(user))
    return NextResponse.json({
      tenants: tenants.map((tenant) => serializeVenue(tenant)),
      canManageVenues: isSuperAdmin(user),
      signedIn: true,
    })
  } catch (error) {
    console.error('Error listing tenants:', error)
    return NextResponse.json({ error: 'Failed to list venues' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePlatformAdmin(request)
    if (error || !user) return error!

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2) {
      return NextResponse.json({ error: 'Venue name is required' }, { status: 400 })
    }

    let slug = slugify(typeof body.slug === 'string' ? body.slug : name)
    if (isReservedUrlStub(slug) || (await tenantsCollection.findBySlug(slug)) || (await tenantsCollection.findByUrlStub(slug))) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    let urlStub = typeof body.urlStub === 'string' ? slugify(body.urlStub) : ''
    if (urlStub && (isReservedUrlStub(urlStub) || urlStub === slug || (await tenantsCollection.findBySlug(urlStub)) || (await tenantsCollection.findByUrlStub(urlStub)))) {
      urlStub = ''
    }

    const credits = Number(body.creditBalance)
    const tenant = await tenantsCollection.create({
      name,
      slug,
      ...(urlStub ? { urlStub } : {}),
      status: 'ACTIVE',
      creditBalance: Number.isFinite(credits) ? Math.max(0, Math.floor(credits)) : 0,
      paymentMode: 'OWN',
      magstripePrefix: ';9998',
      qrNumberStart: 10000,
      ...venueDetailsFromBody(body),
    })

    await tenantUsersCollection.create({
      tenantId: tenant.id,
      userId: user.id,
      role: 'OWNER',
    })

    const template = (await tenantsCollection.findBySlug('default')) || (await tenantsCollection.findMany()).find((item) => item.id !== tenant.id)
    if (template && template.id !== tenant.id) {
      const sourcePlans = await subscriptionPlansCollection.findMany(true, template.id)
      await Promise.all(
        sourcePlans.map((plan) =>
          subscriptionPlansCollection.create({
            tenantId: tenant.id,
            name: plan.name,
            durationYears: plan.durationYears,
            price: plan.price,
            currency: plan.currency,
            isActive: plan.isActive,
          })
        )
      )
    }

    const response = NextResponse.json(tenant, { status: 201 })
    return tenantCookie(response, tenant)
  } catch (error) {
    console.error('Error creating tenant:', error)
    return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 })
  }
}
