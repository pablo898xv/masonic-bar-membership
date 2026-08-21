import { NextRequest, NextResponse } from 'next/server'
import { signupCampaignsCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ensureUserCanAccessTenant, requireTenant } from '@/lib/tenancy'
import {
  allocateSignupToken,
  serializeSignupCampaign,
} from '@/lib/signup-campaigns'

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const campaigns = await signupCampaignsCollection.findByTenant(tenant.id)
    return NextResponse.json({
      campaigns: campaigns.map((campaign) => serializeSignupCampaign(campaign, request)),
    })
  } catch (error) {
    console.error('Error listing signup campaigns:', error)
    return NextResponse.json({ error: 'Failed to load signup campaigns' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : ''
    if (name.length < 2) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }

    const row = await signupCampaignsCollection.create({
      tenantId: tenant.id,
      name,
      token: await allocateSignupToken(),
      status: 'ACTIVE',
      createdByUserId: user.id,
    })

    return NextResponse.json({ campaign: serializeSignupCampaign(row, request) }, { status: 201 })
  } catch (error) {
    console.error('Error creating signup campaign:', error)
    return NextResponse.json({ error: 'Failed to create signup campaign' }, { status: 500 })
  }
}
