import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, tenantLogoPath } from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenantLogoPath(tenant, 'logo'),
      iconUrl: tenantLogoPath(tenant, 'icon'),
    })
  } catch (err) {
    console.error('Error loading branding', err)
    return NextResponse.json({ error: 'Failed to load branding' }, { status: 500 })
  }
}
