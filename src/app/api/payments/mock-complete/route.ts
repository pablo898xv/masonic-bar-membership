import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { addYears } from 'date-fns'

/**
 * Mock payment completion handler for development/testing
 * Simulates the webhook callback from Pixl Pay
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const txn = formData.get('txn') as string
    const status = formData.get('status') as string
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { externalId: txn }
    })
    
    if (!transaction || !transaction.membershipId) {
      return NextResponse.redirect(`${appUrl}/membership/payment-error?error=transaction_not_found`)
    }
    
    const membership = await prisma.membership.findUnique({
      where: { id: transaction.membershipId },
      include: { subscriptionPlan: true }
    })
    
    if (!membership) {
      return NextResponse.redirect(`${appUrl}/membership/payment-error?error=membership_not_found`)
    }
    
    if (status === 'success') {
      const startDate = new Date()
      const expiryDate = addYears(startDate, membership.subscriptionPlan.durationYears)
      
      await prisma.$transaction([
        prisma.membership.update({
          where: { id: membership.id },
          data: {
            paymentStatus: 'COMPLETED',
            status: membership.cardType === 'QR_CODE' ? 'ACTIVE' : 'PAID',
            startDate,
            expiryDate,
          }
        }),
        prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: { status: 'COMPLETED' }
        }),
        ...(membership.cardType === 'PHYSICAL_CARD' ? [
          prisma.cardIssuance.updateMany({
            where: { membershipId: membership.id },
            data: { queueStatus: 'READY_TO_ENCODE' }
          })
        ] : [])
      ])
      
      return NextResponse.redirect(`${appUrl}/membership/payment-complete?membershipId=${membership.id}&status=success`)
    } else {
      await prisma.$transaction([
        prisma.membership.update({
          where: { id: membership.id },
          data: {
            paymentStatus: 'FAILED',
            status: 'PENDING_PAYMENT'
          }
        }),
        prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' }
        })
      ])
      
      return NextResponse.redirect(`${appUrl}/membership/payment-complete?membershipId=${membership.id}&status=failed`)
    }
  } catch (error) {
    console.error('Mock payment completion error:', error)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${appUrl}/membership/payment-error?error=processing_error`)
  }
}
