'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cardTypeLabel } from '@/lib/card-type'

interface Membership {
  id: string
  cardType: string
  status: string
  paymentMethod?: string
  startDate?: string
  expiryDate?: string
  membershipNumber?: { cardNumber: number }
  subscriptionPlan?: { name: string }
}

interface Member {
  id: string
  name: string
  email: string
  phone: string
  createdAt: string
  memberships: Membership[]
}

function statusVariant(status: string): 'success' | 'info' | 'warning' | 'danger' | 'default' {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PAID') return 'info'
  if (status === 'PENDING_PAYMENT') return 'warning'
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'danger'
  return 'default'
}

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchMember = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/members/${id}`)
      if (!res.ok) throw new Error('Member not found')
      setMember(await res.json())
      setError('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load member')
      setMember(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMember()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error || 'Member not found'}</p>
        <Link href="/admin/members">
          <Button className="mt-4">Back to Members</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
          <p className="text-gray-500 mt-1">Member details</p>
        </div>
        <Link href={`/admin/members/${member.id}/purchase`}>
          <Button>New Membership</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{member.email}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium text-gray-900">{member.phone}</p>
            </div>
            <div>
              <p className="text-gray-500">Registered</p>
              <p className="font-medium text-gray-900">
                {new Date(member.createdAt).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Memberships</h2>
        </CardHeader>
        <CardContent>
          {member.memberships?.length ? (
            <div className="space-y-3">
              {member.memberships.map((membership) => (
                <div
                  key={membership.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {membership.subscriptionPlan?.name || 'Unknown plan'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Card #{membership.membershipNumber?.cardNumber ?? '—'} •{' '}
                      {cardTypeLabel(membership.cardType)}
                      {membership.expiryDate
                        ? ` • Expires ${new Date(membership.expiryDate).toLocaleDateString('en-GB')}`
                        : ''}
                    </p>
                    <Link
                      href={`/admin/memberships/${membership.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    {membership.paymentMethod === 'COMPLIMENTARY' && (
                      <Badge variant="info">Complimentary</Badge>
                    )}
                    <Badge variant={statusVariant(membership.status)}>{membership.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-500">No memberships yet</p>
              <Link href={`/admin/members/${member.id}/purchase`}>
                <Button className="mt-4">Create Membership</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
