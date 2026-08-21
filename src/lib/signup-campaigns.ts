import { NextRequest, NextResponse } from 'next/server'
import { generateCardShortCode } from '@/lib/card-link'
import { signupCampaignsCollection, tenantsCollection, type SignupCampaign, type Tenant } from '@/lib/db'
import { publicAppBaseUrl, publicOrigin, publicUrlIsHttps } from '@/lib/public-url'
import { tenantCookie } from '@/lib/tenancy'

export const SIGNUP_COOKIE = 'mbm_signup'
export const SIGNUP_TOKEN_LENGTH = 24
export const SIGNUP_ENDED_MESSAGE = 'This signup campaign has ended'
export const SIGNUP_REQUIRED_MESSAGE = 'Online signup is only available through a current campaign link from the venue'

function cookieSecure() {
  return process.env.NODE_ENV === 'production' || publicUrlIsHttps()
}

export function signupCampaignPath(token: string) {
  return `/j/${encodeURIComponent(token)}`
}

export function signupCampaignUrl(token: string, request?: Request) {
  const origin = request ? publicOrigin(request) : publicAppBaseUrl()
  return `${origin}${signupCampaignPath(token)}`
}

export function serializeSignupCampaign(row: SignupCampaign, request?: Request) {
  return {
    id: row.id,
    name: row.name,
    token: row.token,
    status: row.status,
    url: signupCampaignUrl(row.token, request),
    path: signupCampaignPath(row.token),
    createdAt: row.createdAt,
    endedAt: row.endedAt || null,
  }
}

export async function allocateSignupToken() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const token = generateCardShortCode(SIGNUP_TOKEN_LENGTH)
    const existing = await signupCampaignsCollection.findByToken(token)
    if (!existing) return token
  }
  throw new Error('Could not allocate a signup link')
}

export function signupTokenFromRequest(request: NextRequest) {
  return request.cookies.get(SIGNUP_COOKIE)?.value?.trim() || ''
}

export async function findActiveSignupCampaign(token: string, tenantId?: string) {
  const normalized = token.trim()
  if (!normalized) return null
  const campaign = await signupCampaignsCollection.findByToken(normalized)
  if (!campaign || campaign.status !== 'ACTIVE') return null
  if (tenantId && campaign.tenantId !== tenantId) return null
  return campaign
}

export async function publicSignupStatus(request: NextRequest, tenantId: string) {
  const campaign = await findActiveSignupCampaign(signupTokenFromRequest(request), tenantId)
  if (!campaign) return { open: false as const }
  return { open: true as const, name: campaign.name }
}

export async function requirePublicSignupCampaign(request: NextRequest, tenantId: string) {
  const campaign = await findActiveSignupCampaign(signupTokenFromRequest(request), tenantId)
  if (!campaign) {
    return {
      campaign: null as SignupCampaign | null,
      error: NextResponse.json({ error: SIGNUP_REQUIRED_MESSAGE }, { status: 403 }),
    }
  }
  return { campaign, error: null as NextResponse | null }
}

export function applySignupCookies(response: NextResponse, tenant: Tenant, token: string) {
  tenantCookie(response, tenant)
  response.cookies.set(SIGNUP_COOKIE, token, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: cookieSecure(),
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}

export async function tenantForSignupToken(token: string) {
  const campaign = await findActiveSignupCampaign(token)
  if (!campaign) return { campaign: null as SignupCampaign | null, tenant: null as Tenant | null }
  const tenant = await tenantsCollection.findById(campaign.tenantId)
  if (!tenant || tenant.status !== 'ACTIVE') {
    return { campaign: null as SignupCampaign | null, tenant: null as Tenant | null }
  }
  return { campaign, tenant }
}
