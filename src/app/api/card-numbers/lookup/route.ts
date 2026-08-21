import { NextRequest, NextResponse } from 'next/server'
import {
  membershipNumbersCollection,
  membershipsCollection,
  membersCollection,
  subscriptionPlansCollection,
  cardIssuancesCollection,
} from '@/lib/db'
import { cardNumberFromQuery, stripSentinels } from '@/lib/msrx6/protocol'
import { formatMagstripeData, getMagstripePrefix, getMagstripeTracks } from '@/lib/settings'
import { requireTenant } from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const q = request.nextUrl.searchParams.get('q')?.trim() || ''
    if (!q) {
      return NextResponse.json({ error: 'Enter a card number or swipe a card' }, { status: 400 })
    }

    const magstripePrefix = await getMagstripePrefix(tenant.id)
    const magstripeTracks = await getMagstripeTracks(tenant.id)
    const cardNumber = cardNumberFromQuery(q, magstripePrefix)
    if (cardNumber == null) {
      return NextResponse.json({ error: 'Could not read a card number from that input' }, { status: 400 })
    }

    const magstripeData = await formatMagstripeData(cardNumber, tenant.id)
    const number = await membershipNumbersCollection.findByCardNumber(cardNumber, tenant.id)
    if (!number) {
      return NextResponse.json({
        found: false,
        cardNumber,
        magstripeData,
        magstripePrefix,
        magstripeTracks,
      })
    }

    const linked = await membershipsCollection.findByMembershipNumberId(number.id)
    const memberships = await Promise.all(
      linked.map(async (membership) => {
        const [member, plan, issuance] = await Promise.all([
          membersCollection.findById(membership.memberId),
          subscriptionPlansCollection.findById(membership.subscriptionPlanId),
          cardIssuancesCollection.findByMembershipId(membership.id),
        ])
        return {
          id: membership.id,
          status: membership.status,
          cardType: membership.cardType,
          paymentStatus: membership.paymentStatus,
          startDate: membership.startDate,
          expiryDate: membership.expiryDate,
          tillSystemEnabled: membership.tillSystemEnabled,
          member: member
            ? { id: member.id, name: member.name, email: member.email, phone: member.phone }
            : null,
          plan: plan ? { id: plan.id, name: plan.name } : null,
          issuance: issuance
            ? {
                id: issuance.id,
                queueStatus: issuance.queueStatus,
                magstripeData: issuance.magstripeData,
                encodedAt: issuance.encodedAt,
                issuedAt: issuance.issuedAt,
              }
            : null,
        }
      })
    )

    memberships.sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1
      if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1
      return 0
    })

    return NextResponse.json({
      found: true,
      cardNumber,
      magstripeData,
      magstripePrefix,
      magstripeTracks,
      isAssigned: number.isAssigned,
      assignedAt: number.assignedAt,
      queried: stripSentinels(q),
      memberships,
    })
  } catch (error) {
    console.error('Error looking up card:', error)
    return NextResponse.json({ error: 'Failed to look up card' }, { status: 500 })
  }
}
