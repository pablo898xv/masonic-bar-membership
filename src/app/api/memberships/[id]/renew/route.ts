import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { addYears } from 'date-fns'
import { tollSystem } from '@/lib/toll-system'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { subscriptionPlanId, paymentMethod } = body
    
    const existingMembership = await prisma.membership.findUnique({
      where: { id },
      include: {
        member: true,
        membershipNumber: true,
        subscriptionPlan: true,
      }
    })
    
    if (!existingMembership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (existingMembership.status !== 'ACTIVE' && existingMembership.status !== 'EXPIRED') {
      return NextResponse.json(
        { error: 'Can only renew ACTIVE or EXPIRED memberships' },
        { status: 400 }
      )
    }
    
    const plan = subscriptionPlanId
      ? await prisma.subscriptionPlan.findUnique({ where: { id: subscriptionPlanId } })
      : existingMembership.subscriptionPlan
    
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Subscription plan not found or inactive' }, { status: 404 })
    }
    
    const newStartDate = existingMembership.expiryDate && 
                         new Date(existingMembership.expiryDate) > new Date()
      ? new Date(existingMembership.expiryDate)
      : new Date()
    
    const newExpiryDate = addYears(newStartDate, plan.durationYears)
    
    const renewal = await prisma.membership.create({
      data: {
        memberId: existingMembership.memberId,
        membershipNumberId: existingMembership.membershipNumberId,
        subscriptionPlanId: plan.id,
        cardType: existingMembership.cardType,
        status: 'PENDING_PAYMENT',
        paymentMethod: paymentMethod || existingMembership.paymentMethod,
        paymentStatus: 'PENDING',
      },
      include: {
        member: true,
        membershipNumber: true,
        subscriptionPlan: true,
      }
    })
    
    return NextResponse.json({
      renewal,
      payment: {
        amount: plan.price,
        currency: plan.currency,
        paymentMethod: paymentMethod || existingMembership.paymentMethod,
        redirectUrl: `/api/payments/initiate?membershipId=${renewal.id}`
      },
      message: 'Renewal membership created. Complete payment to activate.',
      previousExpiry: existingMembership.expiryDate,
      newExpiry: newExpiryDate.toISOString(),
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating renewal:', error)
    return NextResponse.json({ error: 'Failed to create renewal' }, { status: 500 })
  }
}
