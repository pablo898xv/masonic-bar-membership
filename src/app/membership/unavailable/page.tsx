import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { PublicCardStatus } from '@/components/brand/public-card-status'
import { cardUnavailableCopy, parseCardUnavailableReason } from '@/lib/card-unavailable'
import { findTenantByPublicStub, tenantLogoPath } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}): Promise<Metadata> {
  const { reason } = await searchParams
  return { title: cardUnavailableCopy(parseCardUnavailableReason(reason)).title }
}

export default async function CardUnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; venue?: string }>
}) {
  const params = await searchParams
  const headerSlug = (await headers()).get('x-tenant-slug') || ''
  const tenant = await findTenantByPublicStub(params.venue || headerSlug)

  return (
    <PublicCardStatus
      reason={parseCardUnavailableReason(params.reason)}
      venueName={tenant?.name}
      logoUrl={tenant ? tenantLogoPath(tenant, 'logo') : ''}
    />
  )
}
