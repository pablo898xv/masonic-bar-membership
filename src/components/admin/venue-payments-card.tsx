'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type VenuePayments = {
  name: string
  slug: string
  bankAccountName: string
  bankSortCode: string
  bankAccountNumberSet: boolean
  publicPath: string
}

export function VenuePaymentsCard({ onSaved }: { onSaved?: (text: string) => void }) {
  const [form, setForm] = useState<VenuePayments | null>(null)
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const res = await fetch('/api/tenants/current')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load venue')
    setForm({
      name: data.tenant.name,
      slug: data.tenant.slug,
      bankAccountName: data.tenant.bankAccountName || '',
      bankSortCode: data.tenant.bankSortCode || '',
      bankAccountNumberSet: Boolean(data.tenant.bankAccountNumberSet),
      publicPath: data.tenant.publicPath,
    })
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load venue'))
  }, [])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/tenants/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMode: 'OWN',
          bankAccountName: form.bankAccountName,
          bankSortCode: form.bankSortCode,
          ...(bankAccountNumber ? { bankAccountNumber } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save venue payments')
      setBankAccountNumber('')
      await load()
      onSaved?.('Venue payout account saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    return error ? <p className="text-sm text-red-600">{error}</p> : null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Open banking payouts</h2>
          <Badge variant={form.bankAccountNumberSet ? 'info' : 'warning'}>
            {form.bankAccountNumberSet ? 'Bank account set' : 'Bank account needed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <p className="text-sm text-gray-600">
            Membership payments for <span className="font-medium">{form.name}</span> are paid into this account via Hope Macy.
            Public signup:{' '}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{form.publicPath}</code>
          </p>
          <Input
            label="Account name"
            value={form.bankAccountName}
            onChange={(event) => setForm({ ...form, bankAccountName: event.target.value })}
          />
          <Input
            label="Sort code"
            value={form.bankSortCode}
            onChange={(event) => setForm({ ...form, bankSortCode: event.target.value })}
            placeholder="000000"
          />
          <Input
            label="Account number"
            type="password"
            value={bankAccountNumber}
            onChange={(event) => setBankAccountNumber(event.target.value)}
            placeholder={form.bankAccountNumberSet ? 'Leave blank to keep the current account number' : '8-digit account number'}
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>Save payout account</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
