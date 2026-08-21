import { NextRequest, NextResponse } from 'next/server'
import { 
  cardIssuancesCollection, 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection,
  subscriptionPlansCollection,
} from '@/lib/db'
import { getMagstripePrefix, getMagstripeTracks, magstripeEncodingCopy } from '@/lib/settings'
import { isPaidMembershipStatus } from '@/lib/payment-methods'
import { requireTenant } from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const includeCompleted = request.nextUrl.searchParams.get('includeCompleted') === 'true'
    const statuses = ['PENDING', 'READY_TO_ENCODE', 'ENCODED']
    if (includeCompleted) {
      statuses.push('ISSUED', 'SHIPPED')
    }

    const issuances = await cardIssuancesCollection.findByStatuses(statuses, tenant.id)
    
    const issuancesWithDetails = await Promise.all(
      issuances.map(async (issuance) => {
        const membership = await membershipsCollection.findById(issuance.membershipId)
        if (!membership) return null
        
        const [member, membershipNumber, subscriptionPlan] = await Promise.all([
          membersCollection.findById(membership.memberId),
          membershipNumbersCollection.findById(membership.membershipNumberId),
          subscriptionPlansCollection.findById(membership.subscriptionPlanId),
        ])

        if (!member || !membershipNumber || !subscriptionPlan) return null
        
        return {
          ...issuance,
          membership: {
            id: membership.id,
            cardType: membership.cardType,
            status: membership.status,
            member: {
              name: member.name,
              email: member.email,
              phone: member.phone,
            },
            membershipNumber: {
              cardNumber: membershipNumber.cardNumber,
            },
            subscriptionPlan: {
              name: subscriptionPlan.name,
            },
          },
        }
      })
    )
    
    const validIssuances = issuancesWithDetails.filter(
      (issuance): issuance is NonNullable<typeof issuance> => issuance !== null
    )

    const paidReady = validIssuances.filter(
      (item) => item.queueStatus === 'READY_TO_ENCODE' && isPaidMembershipStatus(item.membership.status)
    )
    const unpaidOrPending = validIssuances.filter(
      (item) =>
        item.queueStatus === 'PENDING' ||
        (item.queueStatus === 'READY_TO_ENCODE' && !isPaidMembershipStatus(item.membership.status))
    )

    const queue = {
      readyToEncode: paidReady,
      encoded: validIssuances.filter(
        (item) => item.queueStatus === 'ENCODED' && isPaidMembershipStatus(item.membership.status)
      ),
      pending: unpaidOrPending,
      issued: validIssuances.filter((item) => item.queueStatus === 'ISSUED' || item.queueStatus === 'SHIPPED'),
    }

    const summary = {
      total: validIssuances.length,
      readyToEncode: queue.readyToEncode.length,
      encoded: queue.encoded.length,
      pending: queue.pending.length,
      actionRequired: queue.readyToEncode.length + queue.encoded.length,
    }
    
    const magstripePrefix = await getMagstripePrefix(tenant.id)
    const magstripeTracks = await getMagstripeTracks(tenant.id)
    return NextResponse.json({
      queue,
      summary,
      encodingInstructions: magstripeEncodingCopy(magstripePrefix, magstripeTracks),
    })
  } catch (error) {
    console.error('Error fetching card queue:', error)
    return NextResponse.json({ error: 'Failed to fetch card queue' }, { status: 500 })
  }
}
