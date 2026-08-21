import { redirect } from 'next/navigation'
import { QrScanLanding } from '@/components/brand/qr-scan-landing'
import { PublicCardStatus } from '@/components/brand/public-card-status'
import { cardUnavailableBrand } from '@/lib/card-unavailable-brand'
import { cardUnavailableReasonFor } from '@/lib/card-unavailable'
import { qrCodeModeOf } from '@/lib/qr-payload'
import { qrGatewayResponse, qrScanLanding, resolveQrMembership } from '@/lib/qr-gateway'
import { tenantLogoPath } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Membership card' }

export default async function QrGatewayPage({
  params,
}: {
  params: Promise<{ parts: string[] }>
}) {
  const { parts } = await params
  const segments = parts || []
  const membership = await resolveQrMembership(segments)
  const brand = await cardUnavailableBrand({
    tenantId: membership?.tenantId,
    stub: !membership && segments.length === 2 ? segments[0] : undefined,
  })

  if (!membership) {
    return <PublicCardStatus reason="not_found" {...brand} />
  }

  const landing = await qrScanLanding(membership)
  if (qrCodeModeOf(landing.tenant?.qrCodeMode) === 'SCRIPT') {
    return (
      <QrScanLanding
        membership={landing.payload}
        script={landing.script}
        venueName={landing.tenant?.name}
        logoUrl={landing.tenant ? tenantLogoPath(landing.tenant, 'logo') : ''}
      />
    )
  }

  const statusReason = cardUnavailableReasonFor(membership)
  if (statusReason) {
    return <PublicCardStatus reason={statusReason} {...brand} />
  }

  const destination = await qrGatewayResponse(membership)
  if (!destination) {
    return <PublicCardStatus reason="not_found" {...brand} />
  }

  redirect(destination)
}
