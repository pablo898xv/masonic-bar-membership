import { NextRequest, NextResponse } from 'next/server'
import { publicPaymentOptions } from '@/lib/payment-options'
import { publicSignupStatus } from '@/lib/signup-campaigns'
import { requireTenant, tenantLogoPath } from '@/lib/tenancy'
import { passTypesOf } from '@/lib/card-type'

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
      payments: await publicPaymentOptions(tenant),
      signup: await publicSignupStatus(request, tenant.id),
      passTypes: passTypesOf(tenant.passTypes),
    })
  } catch (err) {
    console.error('Error loading branding', err)
    return NextResponse.json({ error: 'Failed to load branding' }, { status: 500 })
  }
}
