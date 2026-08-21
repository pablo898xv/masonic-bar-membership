'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

type ApiKeyRow = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export function VenueApiKeysCard({ onSaved }: { onSaved?: (text: string) => void }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const res = await fetch('/api/tenants/current/api-keys')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load API keys')
    setKeys(data.keys || [])
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load API keys'))
  }, [])

  const createKey = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/tenants/current/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Partner API key' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create API key')
      setSecret(data.secret)
      setName('')
      await load()
      onSaved?.('API key created. Copy it now — it will not be shown again.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key')
    } finally {
      setSaving(false)
    }
  }

  const revoke = async (id: string) => {
    if (!confirm('Revoke this API key? The partner will no longer be able to issue cards.')) return
    setError('')
    try {
      const res = await fetch(`/api/tenants/current/api-keys/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to revoke API key')
      await load()
      onSaved?.('API key revoked.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key')
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-900">Partner API</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Third-party systems can issue a membership with a venue API key. They choose whether this platform sends the usual email and SMS, or suppress those so they notify the member themselves. The card download URL can be returned in the response. Card numbers stay unique at this venue; pass <code>createCardNumber: true</code> to enrol a number that is not already in the pool.
        </p>
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-800">{`POST /api/v1/memberships
Authorization: Bearer mbm_…
{
  "member": { "name": "Jane Doe", "email": "jane@example.com", "phone": "07123456789" },
  "subscriptionPlanId": "plan_id",
  "cardNumber": 1500,
  "createCardNumber": true,
  "cardType": "QR_CODE",
  "notifications": { "email": true, "sms": false },
  "returnCardUrl": true
}`}</pre>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
        <form onSubmit={createKey} className="flex flex-col sm:flex-row gap-3 items-end">
          <Input
            label="Key name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Till integration"
          />
          <Button type="submit" loading={saving}>
            Create API key
          </Button>
        </form>
        {keys.length ? (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{key.name}</p>
                  <p className="font-mono text-gray-500">
                    {key.prefix}…{key.lastUsedAt ? ` · last used ${new Date(key.lastUsedAt).toLocaleString('en-GB')}` : ' · unused'}
                  </p>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={() => void revoke(key.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No API keys yet.</p>
        )}
      </CardContent>
      <Modal isOpen={Boolean(secret)} onClose={() => setSecret('')} title="Copy this API key now">
        <p className="text-sm text-gray-600 mb-3">
          This secret is shown once. Store it in the partner system; it cannot be retrieved later.
        </p>
        <p className="font-mono text-sm break-all bg-gray-50 border border-gray-200 rounded-lg p-3">{secret}</p>
        <div className="flex justify-end mt-4">
          <Button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(secret)
            }}
          >
            Copy
          </Button>
        </div>
      </Modal>
    </Card>
  )
}
