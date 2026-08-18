'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface DashboardStats {
  members: number
  activeMemberships: number
  pendingCards: number
  revenueThisMonth: number
  expiringThisMonth: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [cardQueue, setCardQueue] = useState<any>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [membersRes, membershipsRes, queueRes] = await Promise.all([
          fetch('/api/members?limit=1'),
          fetch('/api/memberships?limit=5'),
          fetch('/api/card-issuance/queue')
        ])

        const membersData = await membersRes.json()
        const membershipsData = await membershipsRes.json()
        const queueData = await queueRes.json()

        setStats({
          members: membersData.pagination?.total || 0,
          activeMemberships: membershipsData.memberships?.filter((m: any) => m.status === 'ACTIVE').length || 0,
          pendingCards: queueData.summary?.actionRequired || 0,
          revenueThisMonth: 0,
          expiringThisMonth: 0
        })

        setRecentActivity(membershipsData.memberships || [])
        setCardQueue(queueData)
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome to the Masonic Hall Bar membership management system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Members</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.members || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Memberships</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.activeMemberships || 0}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Cards Pending</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.pendingCards || 0}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            {(stats?.pendingCards || 0) > 0 && (
              <Link href="/admin/card-queue" className="text-sm text-blue-600 hover:underline mt-2 block">
                View queue →
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Expiring This Month</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.expiringThisMonth || 0}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card Queue */}
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
            {cardQueue?.summary?.actionRequired > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 px-3 bg-yellow-50 rounded-lg">
                  <span className="text-sm font-medium text-yellow-800">Ready to Encode</span>
                  <Badge variant="warning">{cardQueue.summary.readyToEncode}</Badge>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium text-blue-800">Encoded (Ready to Issue)</span>
                  <Badge variant="info">{cardQueue.summary.encoded}</Badge>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-800">Pending Payment</span>
                  <Badge variant="default">{cardQueue.summary.pending}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No cards pending in queue</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
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
              <div className="space-y-3">
                {recentActivity.map((membership: any) => (
                  <div key={membership.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-gray-900">{membership.member?.name}</p>
                      <p className="text-sm text-gray-500">
                        Card #{membership.membershipNumber?.cardNumber} • {membership.cardType === 'QR_CODE' ? 'QR Code' : 'Physical Card'}
                      </p>
                    </div>
                    <Badge variant={
                      membership.status === 'ACTIVE' ? 'success' :
                      membership.status === 'PAID' ? 'info' :
                      membership.status === 'PENDING_PAYMENT' ? 'warning' : 'default'
                    }>
                      {membership.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent memberships</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/members/new"
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
