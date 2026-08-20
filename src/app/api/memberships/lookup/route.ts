import { NextRequest, NextResponse } from 'next/server'
import { membersCollection, membershipsCollection, membershipNumbersCollection, subscriptionPlansCollection } from '@/lib/db'
import { membershipCardUrl, phonesMatch } from '@/lib/card-link'
import { emailService } from '@/lib/email'
import { requireTenant } from '@/lib/tenancy'
import { z } from 'zod'

const lookupSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(10),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = lookupSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Enter a valid email and phone number' }, { status: 400 })
    }

    const { email, phone } = validation.data
    const { tenant } = await requireTenant(request)
    const member = await membersCollection.findByEmail(email, tenant?.id)

    if (!member || !phonesMatch(member.phone, phone)) {
      return NextResponse.json(
        { error: 'We could not find a membership with those details.' },
        { status: 404 }
      )
    }

    const { memberships } = await membershipsCollection.findMany({ memberId: member.id })
    const active = memberships.filter((membership) => ['ACTIVE', 'PAID'].includes(membership.status))

    const cards = await Promise.all(
      active.map(async (membership) => {
        const [membershipNumber, subscriptionPlan] = await Promise.all([
          membershipNumbersCollection.findById(membership.membershipNumberId),
          subscriptionPlansCollection.findById(membership.subscriptionPlanId),
        ])
        const token = membership.accessToken
        return {
          membershipId: membership.id,
          cardNumber: membershipNumber?.cardNumber,
          planName: subscriptionPlan?.name,
          cardType: membership.cardType,
          status: membership.status,
          expiryDate: membership.expiryDate,
          url: token ? membershipCardUrl(membership.id, token) : null,
        }
      })
    )

    const firstUrl = cards.find((card) => card.url)?.url
    if (firstUrl) {
      await emailService.sendEmail({
        to: member.email,
        subject: 'Your Membership Manager membership card',
        html: `<p>Hi ${member.name},</p><p>Open your digital membership card here:</p><p><a href="${firstUrl}">${firstUrl}</a></p>`,
        text: `Hi ${member.name},\n\nOpen your digital membership card: ${firstUrl}`,
      })
    }

    return NextResponse.json({
      memberName: member.name,
      cards,
    })
  } catch (error) {
    console.error('Error looking up membership:', error)
    return NextResponse.json({ error: 'Failed to look up membership' }, { status: 500 })
  }
}
