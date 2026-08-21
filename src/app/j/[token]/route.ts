import { NextRequest, NextResponse } from 'next/server'
import { applySignupCookies, tenantForSignupToken } from '@/lib/signup-campaigns'
import { publicTenantPath } from '@/lib/tenancy'
import { absolutePublicUrl } from '@/lib/public-url'
import { signupCampaignsCollection } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { campaign, tenant } = await tenantForSignupToken(decodeURIComponent(token || ''))
  const search = request.nextUrl.search
  if (!campaign || !tenant) {
    return NextResponse.redirect(absolutePublicUrl(request, `/membership/register${search}`))
  }

  await signupCampaignsCollection.incrementLinkOpens(campaign.id)

  return applySignupCookies(
    NextResponse.redirect(
      absolutePublicUrl(request, `${publicTenantPath(tenant.slug, '/membership/register')}${search}`)
    ),
    tenant,
    campaign.token
  )
}
