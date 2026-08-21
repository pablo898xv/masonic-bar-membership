import { NextRequest, NextResponse } from 'next/server'
import { subscriptionPlansCollection } from '@/lib/db'
import { subscriptionPlanSchema } from '@/lib/validation'
import { requireTenant } from '@/lib/tenancy'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    
    const plans = await subscriptionPlansCollection.findMany(activeOnly, tenant.id)

    return NextResponse.json(plans)
  } catch (error) {
    console.error('Error fetching subscription plans:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription plans' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const body = await request.json()
    
    const validation = subscriptionPlanSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const plan = await subscriptionPlansCollection.create({ ...validation.data, tenantId: tenant.id })
    
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('Error creating subscription plan:', error)
    return NextResponse.json({ error: 'Failed to create subscription plan' }, { status: 500 })
  }
}
