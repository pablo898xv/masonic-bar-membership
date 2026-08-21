'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import Link from 'next/link'

interface Member {
  id: string
  name: string
  email: string
  phone: string
  createdAt: string
  memberships: { status: string }[]
}

function membershipSummaryBadge(memberships: { status: string }[] | undefined) {
  const items = memberships || []
  const active = items.filter((item) => item.status === 'ACTIVE').length
  if (active > 0) {
    return <Badge variant="success">{active} active</Badge>
  }
  if (items.some((item) => item.status === 'PENDING_PAYMENT')) {
    return <Badge variant="warning">Pending payment</Badge>
  }
  if (items.some((item) => item.status === 'PAID')) {
    return <Badge variant="info">Paid</Badge>
  }
  if (items.some((item) => item.status === 'EXPIRED')) {
    return <Badge variant="danger">Expired</Badge>
  }
  return <Badge variant="default">None</Badge>
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [showAddModal, setShowAddModal] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', email: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchMembers = async (page = 1, searchQuery = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' })
      if (searchQuery) params.set('search', searchQuery)
      
      const res = await fetch(`/api/members?${params}`)
      const data = await res.json()
      
      setMembers(data.members || [])
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
    if (new URLSearchParams(window.location.search).get('add') === '1') {
      setShowAddModal(true)
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchMembers(1, search)
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add member')
      }

      setShowAddModal(false)
      setNewMember({ name: '', email: '', phone: '' })
      fetchMembers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 mt-1">Manage bar membership registrations</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-none sm:max-w-md"
            />
            <Button type="submit" variant="secondary" className="w-full sm:w-auto">Search</Button>
          </form>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No members found</p>
              <Button onClick={() => setShowAddModal(true)} className="mt-4">
                Add your first member
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-[40rem]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Phone</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Memberships</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{member.name}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{member.email}</td>
                        <td className="py-3 px-4 text-gray-600">{member.phone}</td>
                        <td className="py-3 px-4">
                          {membershipSummaryBadge(member.memberships)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/members/${member.id}`}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              View
                            </Link>
                            <Link
                              href={`/admin/members/${member.id}?edit=1`}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Edit
                            </Link>
                            <Link
                              href={`/admin/members/${member.id}/purchase`}
                              className="text-green-600 hover:underline text-sm"
                            >
                              New Membership
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Showing {members.length} of {pagination.total} members
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => fetchMembers(pagination.page - 1, search)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => fetchMembers(pagination.page + 1, search)}
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

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Member">
        <form onSubmit={handleAddMember} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}
          <Input
            label="Full Name"
            value={newMember.name}
            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
            required
          />
          <Input
            label="Email Address"
            type="email"
            value={newMember.email}
            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            value={newMember.phone}
            onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
            required
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="w-full sm:w-auto">
              Add Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
