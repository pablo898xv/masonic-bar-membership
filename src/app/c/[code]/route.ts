import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection } from '@/lib/db'
import { membershipCardUrl } from '@/lib/card-link'
import { hasDigitalCard } from '@/lib/card-type'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  if (!/^[0-9A-Za-z]{6,16}$/.test(code || '')) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  const membership = await membershipsCollection.findByShortCode(code)
  if (
    !membership ||
    !membership.accessToken ||
    membership.status === 'CANCELLED' ||
    !hasDigitalCard(membership.cardType)
  ) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  return NextResponse.redirect(membershipCardUrl(membership.id, membership.accessToken), 302)
}
