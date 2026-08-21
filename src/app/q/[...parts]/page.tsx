import { redirect } from 'next/navigation'
import { PublicCardStatus } from '@/components/brand/public-card-status'
import { cardUnavailableBrand } from '@/lib/card-unavailable-brand'
import { cardUnavailableReasonFor } from '@/lib/card-unavailable'
import { qrGatewayResponse, resolveQrMembership } from '@/lib/qr-gateway'

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
  const statusReason = cardUnavailableReasonFor(membership)

  if (statusReason) {
    return <PublicCardStatus reason={statusReason} {...brand} />
  }

  const destination = membership ? await qrGatewayResponse(membership) : null
  if (!destination) {
    return <PublicCardStatus reason="not_found" {...brand} />
  }

  redirect(destination)
}
