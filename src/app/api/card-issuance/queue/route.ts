import { NextRequest, NextResponse } from 'next/server'
import { 
  cardIssuancesCollection, 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection,
  subscriptionPlansCollection,
} from '@/lib/db'
import { getMagstripePrefix } from '@/lib/settings'

export async function GET(request: NextRequest) {
  try {
    const includeCompleted = request.nextUrl.searchParams.get('includeCompleted') === 'true'
    const statuses = ['PENDING', 'READY_TO_ENCODE', 'ENCODED']
    if (includeCompleted) {
      statuses.push('ISSUED', 'SHIPPED')
    }

    const issuances = await cardIssuancesCollection.findByStatuses(statuses)
    
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

    const queue = {
      readyToEncode: validIssuances.filter((item) => item.queueStatus === 'READY_TO_ENCODE'),
      encoded: validIssuances.filter((item) => item.queueStatus === 'ENCODED'),
      pending: validIssuances.filter((item) => item.queueStatus === 'PENDING'),
      issued: validIssuances.filter((item) => item.queueStatus === 'ISSUED' || item.queueStatus === 'SHIPPED'),
    }

    const summary = {
      total: validIssuances.length,
      readyToEncode: queue.readyToEncode.length,
      encoded: queue.encoded.length,
      pending: queue.pending.length,
      actionRequired: queue.readyToEncode.length + queue.encoded.length,
    }
    
    const magstripePrefix = await getMagstripePrefix()
    return NextResponse.json({
      queue,
      summary,
      encodingInstructions: {
        prefix: magstripePrefix,
        format: `${magstripePrefix}{CARD_NUMBER} written to Track 2`,
        example: `${magstripePrefix}1500`,
        note: 'Encode Track 2 exactly as shown (the till swipe track). The number printed on the back of the physical card must match.',
      },
    })
  } catch (error) {
    console.error('Error fetching card queue:', error)
    return NextResponse.json({ error: 'Failed to fetch card queue' }, { status: 500 })
  }
}
