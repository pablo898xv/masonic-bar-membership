'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { VenueLogoUpload } from '@/components/admin/venue-logo-upload'

type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  creditBalance: number
  paymentMode: string
  bankAccountSet?: boolean
  addressLine1: string
  addressLine2: string
  city: string
  county: string
  postcode: string
  country: string
  phone: string
  email: string
  website: string
  contactName: string
  contactRole: string
  contactEmail: string
  contactPhone: string
  logoUrl?: string
}

const emptyDetails = {
  name: '',
  slug: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  county: '',
  postcode: '',
  country: '',
  phone: '',
  email: '',
  website: '',
  contactName: '',
  contactRole: '',
  contactEmail: '',
  contactPhone: '',
}

function summaryLine(tenant: Tenant) {
  const place = [tenant.addressLine1, tenant.city, tenant.postcode].filter(Boolean).join(', ')
  const contact = tenant.contactName
    ? `${tenant.contactName}${tenant.contactRole ? ` (${tenant.contactRole})` : ''}`
    : ''
  return [place, contact, tenant.phone || tenant.email].filter(Boolean).join(' · ')
}

export default function TenantsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [name, setName] = useState('')
  const [credits, setCredits] = useState('0')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [form, setForm] = useState(emptyDetails)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [canManageVenues, setCanManageVenues] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  const load = async () => {
    const res = await fetch('/api/tenants')
    const data = await res.json()
    if (data.signedIn && !data.canManageVenues) {
      router.replace('/admin/settings')
      return
    }
    setTenants(data.tenants || [])
    setCanManageVenues(Boolean(data.canManageVenues))
    setSignedIn(Boolean(data.signedIn))
  }

  useEffect(() => {
    void load()
  }, [])

  const setField = (key: keyof typeof emptyDetails, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openEdit = (tenant: Tenant) => {
    setEditError('')
    setEditing(tenant)
    setForm({
      name: tenant.name || '',
      slug: tenant.slug || '',
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
    })
  }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    const res = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, creditBalance: Number(credits) || 0 }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || 'Failed to create venue')
      return
    }
    setName('')
    setCredits('0')
    await load()
    window.location.reload()
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/tenants/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update venue')
      setEditing(null)
      window.location.reload()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update venue')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!pending) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/tenants/${pending.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete venue')
      setPending(null)
      window.location.reload()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete venue')
    } finally {
      setDeleting(false)
    }
  }

  const lastVenue = tenants.length <= 1

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/admin/platform" className="hover:text-gray-700">Platform settings</Link>
          <span className="mx-1.5">/</span>
          Venues
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Venues</h1>
        <p className="text-gray-500 mt-1">Each venue has its own members, cards, payments, and credits.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Add venue</h2>
        </CardHeader>
        <CardContent>
          {canManageVenues ? (
            <>
              <form onSubmit={create} className="flex flex-wrap gap-3 items-end">
                <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
                <Input label="Starting credits" value={credits} onChange={(event) => setCredits(event.target.value)} />
                <Button type="submit">Create</Button>
              </form>
              {message && <p className="text-sm text-red-600 mt-3">{message}</p>}
            </>
          ) : (
            <p className="text-sm text-gray-600">
              Only a super admin can create venues.{' '}
              {!signedIn && (
                <Link href="/admin/login?next=/admin/platform/venues" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4 align-bottom">Venue</th>
                <th className="py-2 pr-4 align-bottom">Online signup</th>
                <th className="py-2 pr-4 align-bottom">Credits</th>
                <th className="py-2 pr-4 align-bottom">Payments</th>
                <th className="py-2 align-bottom"></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 align-top">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-32 shrink-0 items-center justify-start">
                        {tenant.logoUrl ? (
                          <img src={tenant.logoUrl} alt="" className="max-h-12 max-w-32 object-contain" />
                        ) : (
                          <div className="h-10 w-10 rounded border border-dashed border-gray-200" />
                        )}
                      </div>
                      <div className="min-w-0 leading-5">
                        <p className="font-medium text-gray-900">{tenant.name}</p>
                        <p className="text-gray-500">{tenant.slug}</p>
                        {summaryLine(tenant) && (
                          <p className="mt-1 text-gray-500">{summaryLine(tenant)}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 align-top text-gray-500 leading-5">
                    Campaign links in Venue settings
                  </td>
                  <td className="py-3 pr-4 align-top leading-5">{tenant.creditBalance}</td>
                  <td className="py-3 pr-4 align-top">
                    <Badge variant={tenant.bankAccountSet ? 'info' : 'warning'}>
                      {tenant.bankAccountSet ? 'Payout account set' : 'Payout account needed'}
                    </Badge>
                  </td>
                  <td className="py-3 text-right align-top whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(tenant)}>
                        Edit
                      </Button>
                      {canManageVenues && (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={lastVenue}
                          title={lastVenue ? 'Cannot delete the last venue' : 'Delete venue'}
                          onClick={() => {
                            setDeleteError('')
                            setPending(tenant)
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Edit venue">
        <form onSubmit={save} className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Venue</h3>
            <Input label="Name" value={form.name} onChange={(event) => setField('name', event.target.value)} required />
            <Input
              label="Internal slug"
              value={form.slug}
              onChange={(event) => setField('slug', event.target.value)}
            />
            <p className="text-xs text-gray-500">
              Used for till QR gateway paths and admin switching. Online self-service signup uses campaign
              links from Venue settings, not a permanent public URL.
            </p>
            {editing && (
              <VenueLogoUpload
                tenantId={editing.id}
                logoUrl={editing.logoUrl}
                onUpdated={(logoUrl) => setEditing((current) => (current ? { ...current, logoUrl } : current))}
              />
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Address</h3>
            <Input label="Address line 1" value={form.addressLine1} onChange={(event) => setField('addressLine1', event.target.value)} />
            <Input label="Address line 2" value={form.addressLine2} onChange={(event) => setField('addressLine2', event.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="City / town" value={form.city} onChange={(event) => setField('city', event.target.value)} />
              <Input label="County" value={form.county} onChange={(event) => setField('county', event.target.value)} />
              <Input label="Postcode" value={form.postcode} onChange={(event) => setField('postcode', event.target.value)} />
              <Input label="Country" value={form.country} onChange={(event) => setField('country', event.target.value)} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Venue contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Phone" value={form.phone} onChange={(event) => setField('phone', event.target.value)} />
              <Input label="Email" type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} />
            </div>
            <Input label="Website" value={form.website} onChange={(event) => setField('website', event.target.value)} />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Person responsible</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Name" value={form.contactName} onChange={(event) => setField('contactName', event.target.value)} />
              <Input label="Role" value={form.contactRole} onChange={(event) => setField('contactRole', event.target.value)} placeholder="e.g. General manager" />
              <Input label="Email" type="email" value={form.contactEmail} onChange={(event) => setField('contactEmail', event.target.value)} />
              <Input label="Phone" value={form.contactPhone} onChange={(event) => setField('contactPhone', event.target.value)} />
            </div>
          </section>

          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save venue</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(pending)} onClose={() => setPending(null)} title="Delete venue">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Delete <span className="font-semibold">{pending?.name}</span>? Empty venues can be removed. If it still has members or memberships, delete is blocked so that data is not wiped.
          </p>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => void remove()} loading={deleting}>
              Delete venue
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
