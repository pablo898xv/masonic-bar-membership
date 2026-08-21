'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { cardTypeLabel } from '@/lib/card-type'
import { FinancePeriodGrid, type SubscriptionReport } from '@/components/admin/finance-summary'

interface DashboardStats {
  members: number
  activeMemberships: number
  pendingCards: number
}

interface QueueSummary {
  readyToEncode?: number
  encoded?: number
  pending?: number
  actionRequired?: number
}

interface RecentMembership {
  id: string
  cardType: string
  status: string
  member?: { id?: string; name?: string }
  membershipNumber?: { cardNumber?: number }
}

function StatTile({
  href,
  label,
  value,
  detail,
  iconClass,
  icon,
}: {
  href: string
  label: string
  value: number
  detail: string
  iconClass: string
  icon: ReactNode
}) {
  return (
    <Link href={href} className="block group h-full">
      <Card className="h-full transition-shadow group-hover:shadow-md group-hover:border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
            <div className={`p-3 rounded-full ${iconClass}`}>{icon}</div>
          </div>
          <p className="text-sm text-gray-500 mt-3">{detail}</p>
          <p className="text-sm text-blue-600 mt-2 group-hover:underline">View list →</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function QueueRow({
  href,
  label,
  count,
  tone,
}: {
  href: string
  label: string
  count: number
  tone: 'yellow' | 'blue' | 'gray'
}) {
  const tones = {
    yellow: 'bg-yellow-50 text-yellow-800',
    blue: 'bg-blue-50 text-blue-800',
    gray: 'bg-gray-50 text-gray-800',
  }
  const badges = {
    yellow: 'warning' as const,
    blue: 'info' as const,
    gray: 'default' as const,
  }

  return (
    <Link
      href={href}
      className={`flex items-center justify-between py-2 px-3 rounded-lg ${tones[tone]} hover:opacity-90`}
    >
      <span className="text-sm font-medium">{label}</span>
      <Badge variant={badges[tone]}>{count}</Badge>
    </Link>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<RecentMembership[]>([])
  const [queueSummary, setQueueSummary] = useState<QueueSummary>({})
  const [report, setReport] = useState<SubscriptionReport | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [membersRes, membershipsRes, queueRes, reportRes] = await Promise.all([
          fetch('/api/members?limit=1'),
          fetch('/api/memberships?limit=5'),
          fetch('/api/card-issuance/queue'),
          fetch('/api/reports/subscriptions'),
        ])

        const membersData = await membersRes.json()
        const membershipsData = await membershipsRes.json()
        const queueData = await queueRes.json()
        const reportData = reportRes.ok ? await reportRes.json() : null

        setReport(reportData)
        setStats({
          members: reportData?.counts?.members ?? membersData.pagination?.total ?? 0,
          activeMemberships: reportData?.counts?.activeMemberships ?? 0,
          pendingCards: queueData.summary?.actionRequired || 0,
        })

        setRecentActivity(membershipsData.memberships || [])
        setQueueSummary(queueData.summary || {})
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const readyToEncode = queueSummary.readyToEncode || 0
  const encoded = queueSummary.encoded || 0
  const pendingPayment = queueSummary.pending || 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome to Membership Manager</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatTile
          href="/admin/members"
          label="Total Members"
          value={stats?.members || 0}
          detail="People registered at this venue"
          iconClass="bg-blue-100"
          icon={
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />

        <StatTile
          href="/admin/memberships?status=ACTIVE"
          label="Active Memberships"
          value={stats?.activeMemberships || 0}
          detail="Currently valid cards"
          iconClass="bg-green-100"
          icon={
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatTile
          href="/admin/card-queue"
          label="Cards to action"
          value={stats?.pendingCards || 0}
          detail={`${readyToEncode} to encode · ${encoded} to issue${pendingPayment ? ` · ${pendingPayment} awaiting payment` : ''}`}
          iconClass="bg-yellow-100"
          icon={
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {report && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Subscription sales</h2>
              <p className="text-sm text-gray-500">Paid memberships for {report.venue.name}, Europe/London dates</p>
            </div>
            <Link href="/admin/reports" className="text-sm text-blue-600 hover:underline">
              Full report →
            </Link>
          </div>
          <FinancePeriodGrid report={report} compact href="/admin/reports" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Card Issuance Queue</h2>
              <Link href="/admin/card-queue" className="text-sm text-blue-600 hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <QueueRow
                href="/admin/card-queue#encode"
                label="Ready to Encode"
                count={readyToEncode}
                tone="yellow"
              />
              <QueueRow
                href="/admin/card-queue#issue"
                label="Encoded (Ready to Issue)"
                count={encoded}
                tone="blue"
              />
              <QueueRow
                href="/admin/card-queue#payment"
                label="Pending Payment"
                count={pendingPayment}
                tone="gray"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Memberships</h2>
              <Link href="/admin/memberships" className="text-sm text-blue-600 hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-1">
                {recentActivity.map((membership) => (
                  <Link
                    key={membership.id}
                    href={`/admin/memberships/${membership.id}`}
                    className="flex items-start justify-between gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{membership.member?.name || 'Member'}</p>
                      <p className="text-sm text-gray-500">
                        Card #{membership.membershipNumber?.cardNumber} • {cardTypeLabel(membership.cardType)}
                      </p>
                    </div>
                    <Badge variant={
                      membership.status === 'ACTIVE' ? 'success' :
                      membership.status === 'PAID' ? 'info' :
                      membership.status === 'PENDING_PAYMENT' ? 'warning' : 'default'
                    }>
                      {membership.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent memberships</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/members?add=1"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Member
            </Link>
            <Link
              href="/admin/card-numbers"
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import Card Numbers
            </Link>
            <Link
              href="/admin/subscriptions"
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Manage Plans
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
