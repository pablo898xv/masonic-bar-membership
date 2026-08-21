import { format } from 'date-fns'
import {
  membersCollection,
  membershipsCollection,
  membershipNumbersCollection,
  subscriptionPlansCollection,
  tenantsCollection,
  type Membership,
} from '@/lib/db'
import { membershipCardUrl } from '@/lib/card-link'
import { fillQrRedirectUrl, qrCodeModeOf, qrRedirectUrlError, type QrScanMembership } from '@/lib/qr-payload'
import { findTenantByPublicStub } from '@/lib/tenancy'

const SHORT_CODE = /^[0-9A-Za-z]{6,16}$/
const CARD_NUMBER = /^\d{1,8}$/
const TENANT_SLUG = /^[a-z0-9-]{1,48}$/

function pickMembership(memberships: Membership[]) {
  return (
    memberships.find((membership) => membership.status === 'ACTIVE') ||
    memberships.find((membership) => membership.status === 'PAID') ||
    memberships.find((membership) => membership.status === 'EXPIRED') ||
    memberships.find((membership) => membership.status === 'CANCELLED') ||
    memberships.find((membership) => membership.status === 'PENDING_PAYMENT') ||
    memberships[0] ||
    null
  )
}

async function membershipForCardNumber(cardNumber: number, tenantId: string) {
  const number = await membershipNumbersCollection.findByCardNumber(cardNumber, tenantId)
  if (!number) return null
  const linked = await membershipsCollection.findByMembershipNumberId(number.id)
  return pickMembership(linked.filter((membership) => membership.tenantId === tenantId))
}

export async function resolveQrMembership(parts: string[]) {
  const segments = parts.map((part) => decodeURIComponent(part || '').trim()).filter(Boolean)
  if (segments.length === 1) {
    const code = segments[0]
    if (!SHORT_CODE.test(code)) return null
    return membershipsCollection.findByShortCode(code)
  }

  if (segments.length !== 2) return null

  const [stub, code] = segments
  if (!TENANT_SLUG.test(stub.toLowerCase())) return null
  const tenant = await findTenantByPublicStub(stub)
  if (!tenant) return null

  if (SHORT_CODE.test(code)) {
    const byCode = await membershipsCollection.findByShortCode(code, tenant.id)
    if (byCode) return byCode
  }

  if (CARD_NUMBER.test(code)) {
    return membershipForCardNumber(Number(code), tenant.id)
  }

  return null
}

export async function qrScanLanding(membership: Membership) {
  const [tenant, membershipNumber, member, plan] = await Promise.all([
    tenantsCollection.findById(membership.tenantId),
    membershipNumbersCollection.findById(membership.membershipNumberId),
    membersCollection.findById(membership.memberId),
    subscriptionPlansCollection.findById(membership.subscriptionPlanId),
  ])

  const phone = member?.phone?.trim() || ''
  const expiryDate = membership.expiryDate ? new Date(membership.expiryDate) : null

  const payload: QrScanMembership = {
    name: member?.name?.trim() || '',
    email: member?.email?.trim() || '',
    mobile: phone,
    phone,
    cardNumber: membershipNumber?.cardNumber ?? 0,
    membershipId: membership.id,
    shortCode: membership.shortCode || '',
    status: membership.status,
    planName: plan?.name || '',
    expiryDate: expiryDate ? expiryDate.toISOString() : null,
    expiry: expiryDate ? format(expiryDate, 'dd MMM yyyy') : '',
    tenant: tenant?.name?.trim() || '',
    tenantSlug: tenant?.slug || '',
  }

  return {
    tenant,
    payload,
    script: tenant?.qrScanScript || '',
  }
}

export async function qrGatewayResponse(membership: Membership) {
  if (membership.status === 'CANCELLED' || membership.status === 'PENDING_PAYMENT') return null

  const [tenant, membershipNumber] = await Promise.all([
    tenantsCollection.findById(membership.tenantId),
    membershipNumbersCollection.findById(membership.membershipNumberId),
  ])

  const cardUrl = membership.accessToken ? membershipCardUrl(membership.id, membership.accessToken) : ''

  if (qrCodeModeOf(tenant?.qrCodeMode) === 'URL' && tenant?.qrRedirectUrl?.trim()) {
    if (!qrRedirectUrlError(tenant.qrRedirectUrl)) {
      return fillQrRedirectUrl(tenant.qrRedirectUrl, {
        cardNumber: membershipNumber?.cardNumber ?? '',
        membershipId: membership.id,
        shortCode: membership.shortCode || '',
        tenantSlug: tenant.slug,
      })
    }
  }

  return cardUrl || null
}
