import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { subscriptionFinance } from '@/lib/finance'
import { requireTenant } from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const report = await subscriptionFinance(tenant.id)
    return NextResponse.json({
      venue: { id: tenant.id, name: tenant.name },
      ...report,
    })
  } catch (error) {
    console.error('Error building subscription report:', error)
    return NextResponse.json({ error: 'Failed to load financial summary' }, { status: 500 })
  }
}
