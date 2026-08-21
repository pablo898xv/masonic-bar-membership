import {
  membersCollection,
  membershipsCollection,
  paymentTransactionsCollection,
  signupCampaignsCollection,
  type Membership,
  type PaymentTransaction,
  type SignupCampaign,
} from '@/lib/db'
import { londonDateKey } from '@/lib/finance'
import { isPaidMembershipStatus } from '@/lib/payment-methods'

export type CampaignSignupRow = {
  id: string
  name: string
  status: 'ACTIVE' | 'ENDED'
  createdAt: string
  endedAt: string | null
  linkOpens: number
  members: number
  started: number
  pending: number
  paid: number
  cancelled: number
  revenue: number
  paidOfOpens: number | null
  paidOfStarted: number | null
}

export type CampaignSignupReport = {
  timezone: string
  asOf: string
  totals: Omit<CampaignSignupRow, 'id' | 'name' | 'status' | 'createdAt' | 'endedAt'>
  campaigns: CampaignSignupRow[]
}

function paidMembership(membership: Membership) {
  return isPaidMembershipStatus(membership.status) || membership.paymentStatus === 'COMPLETED'
}

function ratio(paid: number, base: number) {
  if (!base) return null
  return paid / base
}

function emptyTotals(): CampaignSignupReport['totals'] {
  return {
    linkOpens: 0,
    members: 0,
    started: 0,
    pending: 0,
    paid: 0,
    cancelled: 0,
    revenue: 0,
    paidOfOpens: null,
    paidOfStarted: null,
  }
}

function revenueFor(
  memberships: Membership[],
  transactionsByMembership: Map<string, PaymentTransaction[]>
) {
  return memberships.reduce((sum, membership) => {
    const rows = transactionsByMembership.get(membership.id) || []
    return (
      sum +
      rows
        .filter((transaction) => transaction.status === 'COMPLETED' && transaction.amount > 0)
        .reduce((inner, transaction) => inner + (transaction.amount || 0), 0)
    )
  }, 0)
}

function rowFor(
  campaign: SignupCampaign,
  memberships: Membership[],
  memberCount: number,
  transactionsByMembership: Map<string, PaymentTransaction[]>
): CampaignSignupRow {
  const started = memberships.length
  const pending = memberships.filter((membership) => membership.status === 'PENDING_PAYMENT').length
  const cancelled = memberships.filter((membership) => membership.status === 'CANCELLED').length
  const paid = memberships.filter(paidMembership).length
  const linkOpens = campaign.linkOpens || 0
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    createdAt: campaign.createdAt.toISOString(),
    endedAt: campaign.endedAt ? campaign.endedAt.toISOString() : null,
    linkOpens,
    members: memberCount,
    started,
    pending,
    paid,
    cancelled,
    revenue: revenueFor(memberships, transactionsByMembership),
    paidOfOpens: ratio(paid, linkOpens),
    paidOfStarted: ratio(paid, started),
  }
}

export async function campaignSignupReport(tenantId: string, now = new Date()): Promise<CampaignSignupReport> {
  const [campaigns, membershipsResult, membersResult, transactions] = await Promise.all([
    signupCampaignsCollection.findByTenant(tenantId),
    membershipsCollection.findMany({ tenantId }),
    membersCollection.findMany({ tenantId }),
    paymentTransactionsCollection.findByTenantId(tenantId),
  ])

  const transactionsByMembership = new Map<string, PaymentTransaction[]>()
  for (const transaction of transactions) {
    if (!transaction.membershipId || transaction.creditPurchase) continue
    const list = transactionsByMembership.get(transaction.membershipId) || []
    list.push(transaction)
    transactionsByMembership.set(transaction.membershipId, list)
  }

  const membershipsByCampaign = new Map<string, Membership[]>()
  for (const membership of membershipsResult.memberships) {
    if (!membership.signupCampaignId) continue
    const list = membershipsByCampaign.get(membership.signupCampaignId) || []
    list.push(membership)
    membershipsByCampaign.set(membership.signupCampaignId, list)
  }

  const membersByCampaign = new Map<string, number>()
  for (const member of membersResult.members) {
    if (!member.signupCampaignId) continue
    membersByCampaign.set(member.signupCampaignId, (membersByCampaign.get(member.signupCampaignId) || 0) + 1)
  }

  const rows = campaigns.map((campaign) =>
    rowFor(
      campaign,
      membershipsByCampaign.get(campaign.id) || [],
      membersByCampaign.get(campaign.id) || 0,
      transactionsByMembership
    )
  )

  const totals = rows.reduce((acc, row) => {
    acc.linkOpens += row.linkOpens
    acc.members += row.members
    acc.started += row.started
    acc.pending += row.pending
    acc.paid += row.paid
    acc.cancelled += row.cancelled
    acc.revenue += row.revenue
    return acc
  }, emptyTotals())
  totals.paidOfOpens = ratio(totals.paid, totals.linkOpens)
  totals.paidOfStarted = ratio(totals.paid, totals.started)

  return {
    timezone: 'Europe/London',
    asOf: londonDateKey(now),
    totals,
    campaigns: rows,
  }
}
