import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membersCollection, membershipNumbersCollection, subscriptionPlansCollection, systemConfigCollection } from '@/lib/db'
import { requireCronOrAdmin } from '@/lib/auth'
import { emailService } from '@/lib/email'
import { sendMembershipSms } from '@/lib/sms'
import { requireTenant } from '@/lib/tenancy'
import { publicAppBaseUrl } from '@/lib/public-url'

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireCronOrAdmin(request)
    if (error) return error

    let tenantId: string | undefined
    if (user) {
      const resolved = await requireTenant(request)
      if (resolved.error || !resolved.tenant) return resolved.error!
      tenantId = resolved.tenant.id
    }

    const expiringMemberships = await membershipsCollection.findExpiringInRange(0, 30, tenantId)

    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: [] as string[],
    }

    for (const membership of expiringMemberships) {
      results.processed++

      const reminderKey = `renewal_reminder_sent_${membership.id}`
      const alreadySent = await systemConfigCollection.exists(reminderKey)

      if (alreadySent) {
        results.skipped++
        continue
      }

      try {
        const [member, membershipNumber, subscriptionPlan] = await Promise.all([
          membersCollection.findById(membership.memberId),
          membershipNumbersCollection.findById(membership.membershipNumberId),
          subscriptionPlansCollection.findById(membership.subscriptionPlanId),
        ])

        if (!member || !membershipNumber || !subscriptionPlan) {
          results.errors.push(`Missing data for membership ${membership.id}`)
          continue
        }

        const baseUrl = publicAppBaseUrl()
        const token = encodeURIComponent(membership.accessToken || '')
        const renewalLink = `${baseUrl}/membership/renew?id=${encodeURIComponent(membership.id)}${
          token ? `&token=${token}` : ''
        }`

        const { success: sent } = await emailService.sendRenewalReminder({
          memberName: member.name,
          memberEmail: member.email,
          cardNumber: membershipNumber.cardNumber,
          expiryDate: membership.expiryDate!,
          subscriptionName: subscriptionPlan.name,
          renewalUrl: renewalLink,
        })

        try {
          await sendMembershipSms({
            tenantId: membership.tenantId,
            to: member.phone,
            kind: 'renewal',
            membershipId: membership.id,
            fields: {
              member_name: member.name,
              card_number: membershipNumber.cardNumber,
              plan: subscriptionPlan.name,
              expiry: membership.expiryDate!.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
              days: Math.ceil((membership.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
              renewal_url: renewalLink,
            },
          })
        } catch (error) {
          console.error('Renewal SMS failed', error)
        }

        if (sent) {
          await systemConfigCollection.set(reminderKey, new Date().toISOString())
          results.sent++
        } else {
          results.errors.push(`Failed to send email to ${member.email}`)
        }
      } catch (error) {
        results.errors.push(`Error processing membership ${membership.id}: ${error}`)
      }
    }

    return NextResponse.json({
      message: 'Renewal reminder check completed',
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error running renewal reminders:', error)
    return NextResponse.json({ error: 'Failed to run renewal reminders' }, { status: 500 })
  }
}
