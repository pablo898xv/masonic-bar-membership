import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { subscriptionPlanSchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    
    const where = activeOnly ? { isActive: true } : {}
    
    const plans = await prisma.subscriptionPlan.findMany({
      where,
      orderBy: { durationYears: 'asc' }
    })
    
    return NextResponse.json(plans)
  } catch (error) {
    console.error('Error fetching subscription plans:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription plans' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validation = subscriptionPlanSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const plan = await prisma.subscriptionPlan.create({
      data: validation.data
    })
    
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('Error creating subscription plan:', error)
    return NextResponse.json({ error: 'Failed to create subscription plan' }, { status: 500 })
  }
}
