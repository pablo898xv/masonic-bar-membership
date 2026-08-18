import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { subscriptionPlanSchema } from '@/lib/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id }
    })
    
    if (!plan) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 })
    }
    
    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error fetching subscription plan:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription plan' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const validation = subscriptionPlanSchema.partial().safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const existingPlan = await prisma.subscriptionPlan.findUnique({ where: { id } })
    if (!existingPlan) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 })
    }
    
    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: validation.data
    })
    
    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error updating subscription plan:', error)
    return NextResponse.json({ error: 'Failed to update subscription plan' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { memberships: { take: 1 } }
    })
    
    if (!plan) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 })
    }
    
    if (plan.memberships.length > 0) {
      await prisma.subscriptionPlan.update({
        where: { id },
        data: { isActive: false }
      })
      return NextResponse.json({ message: 'Subscription plan deactivated (has existing memberships)' })
    }
    
    await prisma.subscriptionPlan.delete({ where: { id } })
    
    return NextResponse.json({ message: 'Subscription plan deleted successfully' })
  } catch (error) {
    console.error('Error deleting subscription plan:', error)
    return NextResponse.json({ error: 'Failed to delete subscription plan' }, { status: 500 })
  }
}
