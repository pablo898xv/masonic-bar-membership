import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membersCollection, membershipNumbersCollection, subscriptionPlansCollection, systemConfigCollection } from '@/lib/db'
import { emailService } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const expiringMemberships = await membershipsCollection.findExpiringInRange(0, 30)
    
    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: [] as string[]
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
        
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const renewalLink = `${baseUrl}/membership/renew?membershipId=${membership.id}`
        
        const { success: sent } = await emailService.sendRenewalReminder({
          memberName: member.name,
          memberEmail: member.email,
          cardNumber: membershipNumber.cardNumber,
          expiryDate: membership.expiryDate!,
          subscriptionName: subscriptionPlan.name,
          renewalUrl: renewalLink
        })
        
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
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error running renewal reminders:', error)
    return NextResponse.json({ error: 'Failed to run renewal reminders' }, { status: 500 })
  }
}
