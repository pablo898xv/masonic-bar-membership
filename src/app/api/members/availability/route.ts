import { NextRequest, NextResponse } from 'next/server'
import { memberSchema } from '@/lib/validation'
import { requireTenant } from '@/lib/tenancy'
import { signupIdentityBlock } from '@/lib/member-card-limit'
import { requirePublicSignupCampaign } from '@/lib/signup-campaigns'

export async function POST(request: NextRequest) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { error: campaignError } = await requirePublicSignupCampaign(request, tenant.id)
    if (campaignError) return campaignError

    const body = await request.json().catch(() => ({}))
    const validation = memberSchema.pick({ email: true, phone: true }).safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Enter a valid email and phone number' }, { status: 400 })
    }

    const block = await signupIdentityBlock(tenant.id, validation.data.email, validation.data.phone, 'public')
    if (block) {
      return NextResponse.json(block, { status: 409 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error checking member availability:', error)
    return NextResponse.json({ error: 'Failed to check membership details' }, { status: 500 })
  }
}
