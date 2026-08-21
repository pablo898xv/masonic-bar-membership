import { NextRequest, NextResponse } from 'next/server'
import { subscriptionPlansCollection } from '@/lib/db'
import { requirePartner } from '@/lib/partner-auth'

export async function GET(request: NextRequest) {
  try {
    const { tenant, error } = await requirePartner(request)
    if (error || !tenant) return error!

    const plans = await subscriptionPlansCollection.findMany(true, tenant.id)
    return NextResponse.json({
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        durationYears: plan.durationYears,
        price: plan.price,
        currency: plan.currency,
      })),
    })
  } catch (error) {
    console.error('Partner plans failed:', error)
    return NextResponse.json({ error: 'Failed to load plans', code: 'PLANS_FAILED' }, { status: 500 })
  }
}
