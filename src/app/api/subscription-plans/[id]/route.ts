import { NextRequest, NextResponse } from 'next/server'
import { subscriptionPlansCollection, membershipsCollection } from '@/lib/db'
import { subscriptionPlanSchema } from '@/lib/validation'
import { belongsToTenant, requireTenant } from '@/lib/tenancy'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    
    const plan = await subscriptionPlansCollection.findById(id)
    
    if (!plan || !belongsToTenant(plan, tenant.id)) {
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
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    const body = await request.json()
    
    const validation = subscriptionPlanSchema.partial().safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const existingPlan = await subscriptionPlansCollection.findById(id)
    if (!existingPlan || !belongsToTenant(existingPlan, tenant.id)) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 })
    }
    
    const plan = await subscriptionPlansCollection.update(id, validation.data)
    
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
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { id } = await params
    
    const plan = await subscriptionPlansCollection.findById(id)
    
    if (!plan || !belongsToTenant(plan, tenant.id)) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 })
    }
    
    const { memberships } = await membershipsCollection.findMany({ take: 1 })
    const hasMemberships = memberships.some(m => m.subscriptionPlanId === id)
    
    if (hasMemberships) {
      await subscriptionPlansCollection.update(id, { isActive: false })
      return NextResponse.json({ message: 'Subscription plan deactivated (has existing memberships)' })
    }
    
    await subscriptionPlansCollection.delete(id)
    
    return NextResponse.json({ message: 'Subscription plan deleted successfully' })
  } catch (error) {
    console.error('Error deleting subscription plan:', error)
    return NextResponse.json({ error: 'Failed to delete subscription plan' }, { status: 500 })
  }
}
