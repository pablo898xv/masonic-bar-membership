import { NextRequest, NextResponse } from 'next/server'
import { getDb, Timestamp } from '@/lib/firebase'
import {
  Tenant,
  tenantsCollection,
  tenantUsersCollection,
  creditLedgerCollection,
  adminUsersCollection,
  paymentTransactionsCollection,
} from '@/lib/db'
import { getAppSettings } from '@/lib/settings'
import { findPackage, packIsRevocable, parseSmsCreditCost, roundCredits } from '@/lib/credits'
import { voidPaymentOrder } from '@/lib/hopemacy'
import { publicUrlIsHttps } from '@/lib/public-url'

export const TENANT_COOKIE = 'mbm_tenant'
export const TENANT_SLUG_COOKIE = 'mbm_tenant_slug'

const ORPHAN_COLLECTIONS = [
  'members',
  'membershipNumbers',
  'subscriptionPlans',
  'memberships',
  'cardIssuances',
  'walletPasses',
  'paymentTransactions',
]

const TENANT_DATA_COLLECTIONS = [...ORPHAN_COLLECTIONS, 'tenantUsers', 'creditLedger', 'tenantApiKeys', 'signupCampaigns']

export const RESERVED_URL_STUBS = new Set([
  'admin',
  'api',
  'assets',
  'c',
  'j',
  'join',
  'q',
  'favicon.ico',
  'login',
  'logout',
  'membership',
  'memberships',
  'platform',
  'robots.txt',
  'settings',
  'sitemap.xml',
  'static',
  't',
])

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'tenant'
}

export function isReservedUrlStub(value: string) {
  return RESERVED_URL_STUBS.has(value)
}

async function publicStubTaken(stub: string, exceptId?: string) {
  const tenants = await tenantsCollection.findMany()
  return tenants.some(
    (tenant) => tenant.id !== exceptId && (tenant.slug === stub || tenant.urlStub === stub)
  )
}

export async function findTenantByPublicStub(stub: string) {
  const normalized = slugify(stub)
  if (!normalized || isReservedUrlStub(normalized)) return null
  return (
    (await tenantsCollection.findByUrlStub(normalized)) ||
    (await tenantsCollection.findBySlug(normalized))
  )
}

async function tagOrphans(tenantId: string) {
  const db = getDb()
  for (const name of ORPHAN_COLLECTIONS) {
    const snapshot = await db.collection(name).get()
    let batch = db.batch()
    let writes = 0
    for (const doc of snapshot.docs) {
      if (doc.data().tenantId) continue
      batch.update(doc.ref, { tenantId, updatedAt: Timestamp.now() })
      writes += 1
      if (writes === 400) {
        await batch.commit()
        batch = db.batch()
        writes = 0
      }
    }
    if (writes) await batch.commit()
  }
}

export async function ensureDefaultTenant() {
  const existing = await tenantsCollection.findMany()
  if (existing.length) {
    const primary = existing.find((tenant) => tenant.slug === 'default') || existing[0]
    await tagOrphans(primary.id)
    return primary
  }

  const tenant = await tenantsCollection.create({
    name: 'Default venue',
    slug: 'default',
    status: 'ACTIVE',
    creditBalance: 100,
    paymentMode: 'PLATFORM',
    magstripePrefix: ';9998',
  })
  await tagOrphans(tenant.id)
  return tenant
}

async function deleteDocsForTenant(collectionName: string, tenantId: string) {
  const db = getDb()
  const snapshot = await db.collection(collectionName).where('tenantId', '==', tenantId).get()
  let batch = db.batch()
  let writes = 0
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref)
    writes += 1
    if (writes === 400) {
      await batch.commit()
      batch = db.batch()
      writes = 0
    }
  }
  if (writes) await batch.commit()
}

export async function deleteTenant(tenantId: string) {
  const tenant = await tenantsCollection.findById(tenantId)
  if (!tenant) return { ok: false as const, status: 404, error: 'Venue not found' }

  const all = await tenantsCollection.findMany()
  if (all.length <= 1) {
    return { ok: false as const, status: 400, error: 'Cannot delete the last venue' }
  }

  const db = getDb()
  const [membersSnap, membershipsSnap] = await Promise.all([
    db.collection('members').where('tenantId', '==', tenantId).limit(1).get(),
    db.collection('memberships').where('tenantId', '==', tenantId).limit(1).get(),
  ])
  if (!membersSnap.empty || !membershipsSnap.empty) {
    return {
      ok: false as const,
      status: 409,
      error: 'This venue still has members or memberships. Move or delete those first. Deleting a venue permanently removes its cards and memberships.',
    }
  }

  for (const name of TENANT_DATA_COLLECTIONS) {
    await deleteDocsForTenant(name, tenantId)
  }
  await tenantsCollection.delete(tenantId)

  const remaining = all.filter((item) => item.id !== tenantId)
  return { ok: true as const, fallback: remaining[0] }
}

export async function resolveTenant(request: NextRequest): Promise<Tenant | null> {
  await ensureDefaultTenant()
  const slug =
    request.headers.get('x-tenant-slug') ||
    request.cookies.get(TENANT_SLUG_COOKIE)?.value ||
    request.nextUrl.searchParams.get('tenant') ||
    ''
  if (slug) {
    const bySlug = await tenantsCollection.findBySlug(slug)
    if (bySlug) return bySlug
  }
  const id = request.cookies.get(TENANT_COOKIE)?.value
  if (id) {
    const byId = await tenantsCollection.findById(id)
    if (byId) return byId
  }
  const all = await tenantsCollection.findMany()
  return all[0] || null
}

function cookieSecure() {
  return process.env.NODE_ENV === 'production' || publicUrlIsHttps()
}

export function tenantCookie(response: NextResponse, tenant: Tenant) {
  const secure = cookieSecure()
  response.cookies.set(TENANT_COOKIE, tenant.id, { path: '/', sameSite: 'lax', httpOnly: true, secure })
  response.cookies.set(TENANT_SLUG_COOKIE, tenant.slug, { path: '/', sameSite: 'lax', httpOnly: true, secure })
  return response
}

export async function requireTenant(request: NextRequest) {
  const tenant = await resolveTenant(request)
  if (!tenant) {
    return { error: NextResponse.json({ error: 'No tenant found' }, { status: 400 }) as NextResponse, tenant: null }
  }
  if (tenant.status !== 'ACTIVE') {
    return { error: NextResponse.json({ error: 'This venue is suspended' }, { status: 403 }) as NextResponse, tenant: null }
  }
  return { tenant, error: null as NextResponse | null }
}

export function creditsNeeded(cardType: string) {
  return cardType === 'BOTH' ? 2 : 1
}

export const NO_CREDITS_MESSAGE =
  'No issuance credits remaining. Buy a credit pack before issuing a QR code or physical card.'

export async function assertCreditsAvailable(tenantId: string, needed: number) {
  const tenant = await tenantsCollection.findById(tenantId)
  if (!tenant) return { ok: false as const, status: 404, error: 'Tenant not found' }
  if (needed <= 0) return { ok: true as const }
  if (tenant.creditBalance + 1e-9 < needed) {
    return {
      ok: false as const,
      status: 402,
      error:
        tenant.creditBalance < 1
          ? NO_CREDITS_MESSAGE
          : `Not enough issuance credits. This needs ${needed} credit${needed === 1 ? '' : 's'}; ${tenant.creditBalance} remaining.`,
    }
  }
  return { ok: true as const }
}

export async function issuanceAlreadyCharged(
  tenantId: string,
  membershipId: string,
  format: 'QR_CODE' | 'PHYSICAL_CARD',
  membershipNumberId?: string
) {
  const existing = await creditLedgerCollection.findIssue(tenantId, membershipId, format)
  if (existing) return true
  if (!membershipNumberId) return false
  return Boolean(await creditLedgerCollection.findIssueByNumber(tenantId, membershipNumberId, format))
}

export async function unchargedFormats(
  tenantId: string,
  membershipId: string,
  cardType: string,
  membershipNumberId?: string
) {
  const formats =
    cardType === 'BOTH'
      ? (['QR_CODE', 'PHYSICAL_CARD'] as const)
      : cardType === 'PHYSICAL_CARD'
        ? (['PHYSICAL_CARD'] as const)
        : (['QR_CODE'] as const)
  const pending: Array<'QR_CODE' | 'PHYSICAL_CARD'> = []
  for (const format of formats) {
    if (!(await issuanceAlreadyCharged(tenantId, membershipId, format, membershipNumberId))) {
      pending.push(format)
    }
  }
  return pending
}

export function creditsErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.toLowerCase().includes('credit')) {
    return NextResponse.json({ error: message }, { status: 402 })
  }
  return null
}

export function belongsToTenant(resource: { tenantId?: string } | null | undefined, tenantId: string) {
  return Boolean(resource && resource.tenantId === tenantId)
}

export async function consumeIssuanceCredit(
  tenantId: string,
  membershipId: string,
  format: 'QR_CODE' | 'PHYSICAL_CARD',
  createdByUserId?: string,
  membershipNumberId?: string
) {
  if (await issuanceAlreadyCharged(tenantId, membershipId, format, membershipNumberId)) {
    return { ok: true as const, alreadyCharged: true }
  }

  const available = await assertCreditsAvailable(tenantId, 1)
  if (!available.ok) return available

  const tenant = await tenantsCollection.findById(tenantId)
  if (!tenant) return { ok: false as const, status: 404, error: 'Tenant not found' }

  await tenantsCollection.update(tenantId, { creditBalance: roundCredits(tenant.creditBalance - 1) })
  await creditLedgerCollection.create({
    tenantId,
    type: 'ISSUE',
    amount: -1,
    format,
    membershipId,
    membershipNumberId,
    createdByUserId,
    note: format === 'QR_CODE' ? 'Digital QR issued' : 'Physical card issued',
  })
  return { ok: true as const, alreadyCharged: false }
}

export async function addCredits(
  tenantId: string,
  amount: number,
  type: 'TOPUP' | 'GRANT' | 'ADJUSTMENT' | 'REFUND',
  note: string,
  createdByUserId?: string,
  extra?: {
    packageKey?: string
    packageName?: string
    pricePence?: number
    paymentId?: string
    revokedEntryId?: string
  }
) {
  const tenant = await tenantsCollection.findById(tenantId)
  if (!tenant) return { ok: false as const, error: 'Tenant not found' }
  const next = roundCredits(tenant.creditBalance + amount)
  await tenantsCollection.update(tenantId, { creditBalance: next })
  await creditLedgerCollection.create({
    tenantId,
    type,
    amount: roundCredits(amount),
    note,
    createdByUserId,
    ...extra,
  })
  return { ok: true as const, creditBalance: next }
}

export async function consumeSmsCredit(
  tenantId: string,
  note: string,
  createdByUserId?: string,
  membershipId?: string
) {
  const settings = await getAppSettings()
  const cost = parseSmsCreditCost(settings.creditsPerSms)
  if (cost <= 0) return { ok: true as const, charged: 0 }

  const available = await assertCreditsAvailable(tenantId, cost)
  if (!available.ok) {
    return {
      ...available,
      error: `Not enough credits to send SMS. Each SMS uses ${cost} credits.`,
    }
  }

  const tenant = await tenantsCollection.findById(tenantId)
  if (!tenant) return { ok: false as const, status: 404, error: 'Tenant not found' }

  const next = roundCredits(tenant.creditBalance - cost)
  await tenantsCollection.update(tenantId, { creditBalance: next })
  await creditLedgerCollection.create({
    tenantId,
    type: 'SMS',
    amount: -cost,
    membershipId,
    createdByUserId,
    note,
  })
  return { ok: true as const, charged: cost, creditBalance: next }
}

export async function fulfillCreditPurchase(transaction: {
  id: string
  tenantId?: string
  creditPurchase?: boolean
  status: string
  externalId?: string
  metadata?: Record<string, unknown>
}) {
  if (!transaction.creditPurchase || !transaction.tenantId) {
    return { ok: false as const, error: 'Not a credit pack purchase' }
  }

  const paymentId = transaction.externalId || transaction.id
  const existing = await creditLedgerCollection.findByPaymentId(paymentId)
  if (existing || transaction.status === 'COMPLETED') {
    return { ok: true as const, alreadyApplied: true }
  }

  const packageKey = typeof transaction.metadata?.packageKey === 'string' ? transaction.metadata.packageKey : ''
  const pack = findPackage(packageKey)
  if (!pack) return { ok: false as const, error: 'Unknown credit pack' }

  const result = await addCredits(
    transaction.tenantId,
    pack.credits,
    'TOPUP',
    `Purchased ${pack.name}`,
    undefined,
    {
      packageKey: pack.key,
      packageName: pack.name,
      pricePence: pack.pricePence,
      paymentId,
    }
  )
  if (!result.ok) return result

  await paymentTransactionsCollection.update(transaction.id, { status: 'COMPLETED' })
  return { ok: true as const, alreadyApplied: false, creditBalance: result.creditBalance }
}

export async function revokeCreditPack(
  tenantId: string,
  entryId: string,
  revokedByUserId?: string
) {
  const entry = await creditLedgerCollection.findById(entryId)
  if (!entry || entry.tenantId !== tenantId) {
    return { ok: false as const, status: 404, error: 'Pack grant not found' }
  }
  if (!packIsRevocable(entry)) {
    return { ok: false as const, status: 400, error: 'That pack cannot be revoked' }
  }

  const tenant = await tenantsCollection.findById(tenantId)
  if (!tenant) return { ok: false as const, status: 404, error: 'Venue not found' }
  if (tenant.creditBalance < entry.amount) {
    return {
      ok: false as const,
      status: 409,
      error: 'This pack cannot be revoked because some of its credits have already been used.',
    }
  }

  const result = await addCredits(
    tenantId,
    -entry.amount,
    'REFUND',
    `Revoked ${entry.packageName || 'credit pack'}`,
    revokedByUserId,
    {
      packageKey: entry.packageKey,
      packageName: entry.packageName,
      pricePence: entry.pricePence,
      paymentId: entry.paymentId,
      revokedEntryId: entry.id,
    }
  )
  if (!result.ok) return { ok: false as const, status: 404, error: result.error }

  await creditLedgerCollection.update(entry.id, {
    revoked: true,
    revokedAt: new Date(),
    revokedByUserId,
  })

  if (entry.type === 'TOPUP' && entry.paymentId && !entry.paymentId.startsWith('mock_')) {
    await voidPaymentOrder(entry.paymentId)
  }

  return { ok: true as const, creditBalance: result.creditBalance, refunded: entry.amount }
}

export async function creditorForTenant(tenant: Tenant) {
  return {
    source: 'OWN' as const,
    name: tenant.bankAccountName || tenant.name,
    sortCode: tenant.bankSortCode || '',
    accountNumber: tenant.bankAccountNumber || '',
  }
}

export async function platformCreditor() {
  const settings = await getAppSettings()
  return {
    source: 'PLATFORM' as const,
    name: settings.bankAccountName || 'Ashlar Technologies',
    sortCode: settings.bankSortCode,
    accountNumber: settings.bankAccountNumber,
  }
}

export function publicTenantPath(slug: string, path = '/membership/register') {
  return `/t/${slug}${path}`
}

export async function userTenants(userId: string, isPlatformAdmin: boolean) {
  if (isPlatformAdmin) return tenantsCollection.findMany()
  const links = await tenantUsersCollection.findByUser(userId)
  const tenants = await Promise.all(links.map((link) => tenantsCollection.findById(link.tenantId)))
  return tenants.filter((tenant): tenant is Tenant => Boolean(tenant))
}

export function isPlatformAdmin(user: { isPlatformAdmin?: boolean; role?: string }) {
  return Boolean(user.isPlatformAdmin)
}

export async function ensureUserCanAccessTenant(userId: string, tenantId: string) {
  const user = await adminUsersCollection.findById(userId)
  if (user && isPlatformAdmin(user)) return true
  const link = await tenantUsersCollection.find(userId, tenantId)
  return Boolean(link)
}

const VENUE_DETAIL_KEYS = [
  'addressLine1',
  'addressLine2',
  'city',
  'county',
  'postcode',
  'country',
  'phone',
  'email',
  'website',
  'contactName',
  'contactRole',
  'contactEmail',
  'contactPhone',
] as const

export function tenantHasLogo(tenant: { logoPng?: string } | null | undefined) {
  return Boolean(tenant?.logoPng)
}

export function tenantLogoPath(
  tenant: { id: string; logoPng?: string; iconPng?: string; logoUpdatedAt?: Date },
  kind: 'logo' | 'icon' = 'logo'
) {
  const bytes = kind === 'icon' ? tenant.iconPng || tenant.logoPng : tenant.logoPng
  if (!bytes) return ''
  const version = tenant.logoUpdatedAt ? new Date(tenant.logoUpdatedAt).getTime() : 0
  return `/api/branding/${encodeURIComponent(tenant.id)}/${kind}${version ? `?v=${version}` : ''}`
}

export function serializeVenue(tenant: Tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    urlStub: tenant.urlStub || '',
    status: tenant.status,
    creditBalance: tenant.creditBalance,
    paymentMode: tenant.paymentMode,
    hasLogo: tenantHasLogo(tenant),
    logoUrl: tenantLogoPath(tenant, 'logo'),
    iconUrl: tenantLogoPath(tenant, 'icon'),
    bankAccountSet: Boolean(tenant.bankSortCode && tenant.bankAccountNumber),
    addressLine1: tenant.addressLine1 || '',
    addressLine2: tenant.addressLine2 || '',
    city: tenant.city || '',
    county: tenant.county || '',
    postcode: tenant.postcode || '',
    country: tenant.country || '',
    phone: tenant.phone || '',
    email: tenant.email || '',
    website: tenant.website || '',
    contactName: tenant.contactName || '',
    contactRole: tenant.contactRole || '',
    contactEmail: tenant.contactEmail || '',
    contactPhone: tenant.contactPhone || '',
    publicPath: `/t/${tenant.slug}/membership/register`,
    shortPath: '',
  }
}

export function venueDetailsFromBody(body: Record<string, unknown>): Partial<Tenant> {
  const patch: Partial<Tenant> = {}
  for (const key of VENUE_DETAIL_KEYS) {
    if (typeof body[key] === 'string') {
      patch[key] = body[key].trim()
    }
  }
  return patch
}

export async function applyVenueIdentity(body: Record<string, unknown>, current: Tenant) {
  const patch: Partial<Tenant> = { ...venueDetailsFromBody(body) }

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (name.length < 2) {
      return { error: 'Venue name is required', status: 400 as const, patch: null }
    }
    patch.name = name
  }

  if (typeof body.slug === 'string' && body.slug.trim()) {
    const slug = slugify(body.slug)
    if (isReservedUrlStub(slug)) {
      return { error: 'That public URL is reserved', status: 400 as const, patch: null }
    }
    if (slug !== current.slug) {
      if (await publicStubTaken(slug, current.id)) {
        return { error: 'That public URL is already in use', status: 409 as const, patch: null }
      }
      patch.slug = slug
    }
  }

  if (typeof body.urlStub === 'string') {
    const urlStub = slugify(body.urlStub)
    if (!body.urlStub.trim() || urlStub === (patch.slug || current.slug)) {
      patch.urlStub = ''
    } else {
      if (isReservedUrlStub(urlStub)) {
        return { error: 'That short URL is reserved', status: 400 as const, patch: null }
      }
      if (await publicStubTaken(urlStub, current.id)) {
        return { error: 'That short URL is already in use', status: 409 as const, patch: null }
      }
      patch.urlStub = urlStub
    }
  }

  return { patch, error: null, status: 200 as const }
}
