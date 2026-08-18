import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { pixlPay, WebhookPayload } from '@/lib/pixlpay'
import { addYears } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('X-Pixl-Signature') || ''
    
    if (!pixlPay.verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    const payload: WebhookPayload = JSON.parse(rawBody)
    
    const { event, transactionId, reference } = payload
    
    const membershipId = reference.replace('MEMBERSHIP-', '')
    
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { subscriptionPlan: true }
    })
    
    if (!membership) {
      console.error(`Membership not found for transaction ${transactionId}`)
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    switch (event) {
      case 'payment.completed':
        const startDate = new Date()
        const expiryDate = addYears(startDate, membership.subscriptionPlan.durationYears)
        
        await prisma.$transaction([
          prisma.membership.update({
            where: { id: membershipId },
            data: {
              paymentStatus: 'COMPLETED',
              status: membership.cardType === 'QR_CODE' ? 'ACTIVE' : 'PAID',
              startDate,
              expiryDate,
            }
          }),
          prisma.paymentTransaction.updateMany({
            where: { externalId: transactionId },
            data: { status: 'COMPLETED' }
          }),
          ...(membership.cardType === 'PHYSICAL_CARD' ? [
            prisma.cardIssuance.updateMany({
              where: { membershipId },
              data: { queueStatus: 'READY_TO_ENCODE' }
            })
          ] : [])
        ])
        
        console.log(`Payment completed for membership ${membershipId}`)
        break
        
      case 'payment.failed':
        await prisma.$transaction([
          prisma.membership.update({
            where: { id: membershipId },
            data: {
              paymentStatus: 'FAILED',
              status: 'PENDING_PAYMENT'
            }
          }),
          prisma.paymentTransaction.updateMany({
            where: { externalId: transactionId },
            data: { status: 'FAILED' }
          })
        ])
        
        console.log(`Payment failed for membership ${membershipId}`)
        break
        
      case 'payment.refunded':
        await prisma.$transaction([
          prisma.membership.update({
            where: { id: membershipId },
            data: {
              paymentStatus: 'REFUNDED',
              status: 'CANCELLED'
            }
          }),
          prisma.paymentTransaction.updateMany({
            where: { externalId: transactionId },
            data: { status: 'REFUNDED' }
          })
        ])
        
        console.log(`Payment refunded for membership ${membershipId}`)
        break
        
      default:
        console.log(`Unknown webhook event: ${event}`)
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
