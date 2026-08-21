'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { maskAccountNumber, maskSortCode } from '@/lib/bank-account'

type VenuePayments = {
  name: string
  bankAccountName: string
  bankSortCode: string
  bankAccountNumberSet: boolean
  openBankingEnabled: boolean
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
      bankAccountName: data.tenant.bankAccountName || '',
      bankSortCode: maskSortCode(data.tenant.bankSortCode || ''),
      bankAccountNumberSet: Boolean(data.tenant.bankAccountNumberSet),
      openBankingEnabled: data.tenant.openBankingEnabled !== false,
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
          openBankingEnabled: form.openBankingEnabled,
          bankAccountName: form.bankAccountName,
          bankSortCode: maskSortCode(form.bankSortCode),
          ...(bankAccountNumber ? { bankAccountNumber: maskAccountNumber(bankAccountNumber) } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save venue payments')
      setBankAccountNumber('')
      await load()
      onSaved?.('Open banking settings saved')
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
          <Badge
            variant={
              !form.openBankingEnabled ? 'default' : form.bankAccountNumberSet ? 'success' : 'warning'
            }
          >
            {!form.openBankingEnabled
              ? 'Off'
              : form.bankAccountNumberSet
                ? 'Live'
                : 'Bank account needed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-gray-600">
              Membership payments for <span className="font-medium">{form.name}</span> are paid into this
              account via open banking. Members buy online only through a campaign link from Venue settings.
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-700 shrink-0">
              <input
                type="checkbox"
                checked={form.openBankingEnabled}
                onChange={(event) => setForm({ ...form, openBankingEnabled: event.target.checked })}
              />
              Enable
            </label>
          </div>
          <Input
            label="Account name"
            value={form.bankAccountName}
            onChange={(event) => setForm({ ...form, bankAccountName: event.target.value })}
          />
          <Input
            label="Sort code"
            value={form.bankSortCode}
            onChange={(event) => setForm({ ...form, bankSortCode: maskSortCode(event.target.value) })}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="off"
            className="font-mono"
          />
          <Input
            label="Account number"
            type="password"
            value={bankAccountNumber}
            onChange={(event) => setBankAccountNumber(maskAccountNumber(event.target.value))}
            placeholder={form.bankAccountNumberSet ? 'Leave blank to keep the current account number' : '12345678'}
            autoComplete="new-password"
            inputMode="numeric"
            className="font-mono"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>Save open banking</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
