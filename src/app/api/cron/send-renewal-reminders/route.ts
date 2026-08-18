import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { emailService } from '@/lib/email'
import { addDays, subDays } from 'date-fns'

/**
 * Cron job endpoint to send renewal reminder emails
 * 
 * This should be called daily to send reminders to members whose
 * memberships are expiring within the next 30 days.
 * 
 * The system tracks which reminders have been sent to avoid duplicates.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const thirtyDaysFromNow = addDays(now, 30)
    const twentyNineDaysFromNow = addDays(now, 29)
    
    const expiringMemberships = await prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          gte: twentyNineDaysFromNow,
          lte: thirtyDaysFromNow
        }
      },
      include: {
        member: true,
        membershipNumber: true,
        subscriptionPlan: true,
      }
    })

    const results = {
      processed: 0,
      emailsSent: 0,
      alreadySent: 0,
      errors: [] as string[]
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    for (const membership of expiringMemberships) {
      results.processed++

      const reminderKey = `renewal_reminder_30d_${membership.id}`
      const existingReminder = await prisma.systemConfig.findUnique({
        where: { key: reminderKey }
      })

      if (existingReminder) {
        results.alreadySent++
        continue
      }

      try {
        const renewalUrl = `${appUrl}/membership/renew?id=${membership.id}&token=${Buffer.from(membership.id).toString('base64')}`

        const emailResult = await emailService.sendRenewalReminder({
          memberName: membership.member.name,
          memberEmail: membership.member.email,
          cardNumber: membership.membershipNumber.cardNumber,
          expiryDate: membership.expiryDate!,
          subscriptionName: membership.subscriptionPlan.name,
          renewalUrl,
        })

        if (emailResult.success) {
          await prisma.systemConfig.create({
            data: {
              key: reminderKey,
              value: now.toISOString(),
            }
          })
          results.emailsSent++
        } else {
          results.errors.push(`Failed to send email to ${membership.member.email}: ${emailResult.error}`)
        }
      } catch (error: any) {
        results.errors.push(`Error processing membership ${membership.id}: ${error.message}`)
      }
    }

    console.log('Renewal reminders completed:', results)

    return NextResponse.json({
      success: true,
      ...results,
      emailConfigured: emailService.isConfigured(),
      timestamp: now.toISOString()
    })
  } catch (error) {
    console.error('Error sending renewal reminders:', error)
    return NextResponse.json({ error: 'Failed to send renewal reminders' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const thirtyDaysFromNow = addDays(now, 30)
    
    const expiringCount = await prisma.membership.count({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          gte: now,
          lte: thirtyDaysFromNow
        }
      }
    })

    return NextResponse.json({
      message: 'Use POST to send renewal reminders',
      expiringInNext30Days: expiringCount,
      emailConfigured: emailService.isConfigured(),
      hint: 'Set CRON_SECRET env var and pass it as Bearer token for production use'
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check expiring memberships' }, { status: 500 })
  }
}
