'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import Link from 'next/link'
import { format } from 'date-fns'

interface Membership {
  id: string
  cardType: string
  status: string
  paymentStatus: string
  startDate?: string
  expiryDate?: string
  tollSystemEnabled: boolean
  member: {
    id: string
    name: string
    email: string
  }
  membershipNumber: {
    cardNumber: number
  }
  subscriptionPlan: {
    name: string
    durationYears: number
    price: number
  }
}

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [cardTypeFilter, setCardTypeFilter] = useState('')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })

  const fetchMemberships = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      if (cardTypeFilter) params.set('cardType', cardTypeFilter)
      
      const res = await fetch(`/api/memberships?${params}`)
      const data = await res.json()
      
      setMemberships(data.memberships || [])
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('Error fetching memberships:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMemberships()
  }, [statusFilter, cardTypeFilter])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
      ACTIVE: 'success',
      PAID: 'info',
      PENDING_PAYMENT: 'warning',
      EXPIRED: 'danger',
      CANCELLED: 'default'
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const handleEnableTollSystem = async (membershipId: string) => {
    try {
      await fetch('/api/toll-system/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId })
      })
      fetchMemberships(pagination.page)
    } catch (error) {
      console.error('Error enabling toll system:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Memberships</h1>
          <p className="text-gray-500 mt-1">View and manage all memberships</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'PAID', label: 'Paid' },
                { value: 'PENDING_PAYMENT', label: 'Pending Payment' },
                { value: 'EXPIRED', label: 'Expired' },
                { value: 'CANCELLED', label: 'Cancelled' }
              ]}
              className="w-48"
            />
            <Select
              value={cardTypeFilter}
              onChange={(e) => setCardTypeFilter(e.target.value)}
              options={[
                { value: '', label: 'All Card Types' },
                { value: 'QR_CODE', label: 'QR Code' },
                { value: 'PHYSICAL_CARD', label: 'Physical Card' }
              ]}
              className="w-48"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : memberships.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No memberships found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Card #</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Member</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Plan</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Expiry</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Toll</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberships.map((membership) => (
                      <tr key={membership.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-mono font-medium">
                            {membership.membershipNumber.cardNumber}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Link href={`/admin/members/${membership.member.id}`} className="hover:underline">
                            <p className="font-medium text-gray-900">{membership.member.name}</p>
                            <p className="text-sm text-gray-500">{membership.member.email}</p>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {membership.subscriptionPlan.name}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={membership.cardType === 'QR_CODE' ? 'info' : 'default'}>
                            {membership.cardType === 'QR_CODE' ? 'QR Code' : 'Physical'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(membership.status)}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {membership.expiryDate
                            ? format(new Date(membership.expiryDate), 'dd MMM yyyy')
                            : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {membership.tollSystemEnabled ? (
                            <Badge variant="success">Enabled</Badge>
                          ) : membership.status === 'ACTIVE' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEnableTollSystem(membership.id)}
                            >
                              Enable
                            </Button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/memberships/${membership.id}`}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              View
                            </Link>
                            {membership.status === 'ACTIVE' && membership.cardType === 'QR_CODE' && (
                              <Link
                                href={`/api/memberships/${membership.id}/wallet-pass?format=qrcode`}
                                target="_blank"
                                className="text-green-600 hover:underline text-sm"
                              >
                                QR Code
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Showing {memberships.length} of {pagination.total} memberships
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => fetchMemberships(pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => fetchMemberships(pagination.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
