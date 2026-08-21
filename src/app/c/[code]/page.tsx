import { redirect } from 'next/navigation'
import { PublicCardStatus } from '@/components/brand/public-card-status'
import { membershipCardUrl } from '@/lib/card-link'
import { hasDigitalCard } from '@/lib/card-type'
import { cardUnavailableBrand } from '@/lib/card-unavailable-brand'
import {
  cardUnavailableReasonFor,
  type CardUnavailableReason,
} from '@/lib/card-unavailable'
import { membershipsCollection } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Membership card' }

export default async function CardShortLinkPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  if (!/^[0-9A-Za-z]{6,16}$/.test(code || '')) {
    return <PublicCardStatus reason="not_found" />
  }

  const membership = await membershipsCollection.findByShortCode(code)
  const brand = await cardUnavailableBrand({ tenantId: membership?.tenantId })
  const statusReason = cardUnavailableReasonFor(membership)

  if (statusReason) {
    return <PublicCardStatus reason={statusReason} {...brand} />
  }

  if (!membership?.accessToken || !hasDigitalCard(membership.cardType)) {
    const reason: CardUnavailableReason =
      membership && !hasDigitalCard(membership.cardType) ? 'physical' : 'not_found'
    return <PublicCardStatus reason={reason} {...brand} />
  }

  redirect(membershipCardUrl(membership.id, membership.accessToken))
}
