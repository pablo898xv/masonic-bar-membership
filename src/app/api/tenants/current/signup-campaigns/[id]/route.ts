import { NextRequest, NextResponse } from 'next/server'
import { signupCampaignsCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { belongsToTenant, ensureUserCanAccessTenant, requireTenant } from '@/lib/tenancy'
import { serializeSignupCampaign } from '@/lib/signup-campaigns'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const { id } = await params
    const campaign = await signupCampaignsCollection.findById(id)
    if (!campaign || !belongsToTenant(campaign, tenant.id)) {
      return NextResponse.json({ error: 'Signup campaign not found' }, { status: 404 })
    }
    if (campaign.status === 'ENDED') {
      return NextResponse.json({ campaign: serializeSignupCampaign(campaign, request) })
    }

    const updated = await signupCampaignsCollection.update(id, {
      status: 'ENDED',
      endedAt: new Date(),
    })
    return NextResponse.json({ campaign: serializeSignupCampaign(updated, request) })
  } catch (error) {
    console.error('Error ending signup campaign:', error)
    return NextResponse.json({ error: 'Failed to end signup campaign' }, { status: 500 })
  }
}
