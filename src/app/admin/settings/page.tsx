'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { VenuePaymentsCard } from '@/components/admin/venue-payments-card'

type VenueOps = {
  magstripePrefix: string
  tillSystemApiUrl: string
  tillSystemApiKeySet: boolean
}

export default function SettingsPage() {
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [ops, setOps] = useState<VenueOps>({
    magstripePrefix: ';9998',
    tillSystemApiUrl: '',
    tillSystemApiKeySet: false,
  })
  const [tillApiKey, setTillApiKey] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch('/api/tenants/current')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load venue')
    setOps({
      magstripePrefix: data.tenant.magstripePrefix || ';9998',
      tillSystemApiUrl: data.tenant.tillSystemApiUrl || '',
      tillSystemApiKeySet: Boolean(data.tenant.tillSystemApiKeySet),
    })
  }

  useEffect(() => {
    void load().catch((error) => {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load venue' })
    })
  }, [])

  const saveOps = async (event: FormEvent, section: string) => {
    event.preventDefault()
    setSaving(section)
    setMessage(null)
    try {
      const res = await fetch('/api/tenants/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          section === 'till'
            ? {
                tillSystemApiUrl: ops.tillSystemApiUrl,
                ...(tillApiKey ? { tillSystemApiKey: tillApiKey } : {}),
              }
            : {
                magstripePrefix: ops.magstripePrefix.trim() || ';9998',
              }
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save venue settings')
      setTillApiKey('')
      await load()
      setMessage({ type: 'ok', text: 'Venue settings saved.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save' })
    } finally {
      setSaving(null)
    }
  }

  const runJob = async (path: string, key: string) => {
    setRunning(key)
    setMessage(null)
    try {
      const res = await fetch(path, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to run job')
      const results = data.results || data
      if (key === 'expiry') {
        setMessage({
          type: 'ok',
          text: `Processed ${results.processed}, expired ${results.expired}, till disabled ${results.tillSystemDisabled}.`,
        })
      } else {
        setMessage({
          type: 'ok',
          text: `Processed ${results.processed}, emails sent ${results.sent}, already sent ${results.skipped}.`,
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to run job',
      })
    } finally {
      setRunning(null)
    }
  }

  const tillConfigured = Boolean(ops.tillSystemApiUrl && ops.tillSystemApiKeySet)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Venue settings</h1>
        <p className="text-gray-500 mt-1">
          Payout account, till, magstripe, and membership reminders for this venue.
        </p>
      </div>

      {message && (
        <p
          className={`text-sm rounded-lg p-3 border ${
            message.type === 'ok'
              ? 'text-green-800 bg-green-50 border-green-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}
        >
          {message.text}
        </p>
      )}

      <VenuePaymentsCard onSaved={(text) => setMessage({ type: 'ok', text })} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Magstripe card configuration</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => saveOps(event, 'magstripe')} className="space-y-4">
              <p className="text-sm text-gray-600">
                Track 2 data written to physical cards for this venue. The prefix is followed by the number printed on the back of the card.
              </p>
              <div className="grid grid-cols-1 gap-4">
                <Input
                  label="Track 2 prefix"
                  value={ops.magstripePrefix}
                  onChange={(event) => setOps({ ...ops, magstripePrefix: event.target.value })}
                  className="font-mono"
                />
                <div>
                  <p className="block text-sm font-medium text-gray-700 mb-1">Example card 1500</p>
                  <p className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 font-mono text-gray-900">
                    {ops.magstripePrefix || ';9998'}1500
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={saving === 'magstripe'}>Save magstripe prefix</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Till system</h2>
              {tillConfigured ? <Badge variant="success">Configured</Badge> : <Badge variant="warning">Mock mode</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => saveOps(event, 'till')} className="space-y-4">
              <p className="text-sm text-gray-600">
                Notify this venue’s till when a card is issued or a membership expires.
              </p>
              <Input
                label="API URL"
                value={ops.tillSystemApiUrl}
                onChange={(event) => setOps({ ...ops, tillSystemApiUrl: event.target.value })}
                placeholder="https://till.example/api"
              />
              <Input
                label="API key"
                type="password"
                value={tillApiKey}
                onChange={(event) => setTillApiKey(event.target.value)}
                placeholder={ops.tillSystemApiKeySet ? 'Leave blank to keep the current key' : 'API key'}
                autoComplete="new-password"
              />
              <div className="flex justify-end">
                <Button type="submit" loading={saving === 'till'}>Save till settings</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Membership reminders</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-gray-900">Check expired memberships</h3>
              <p className="text-sm text-gray-500">
                Mark this venue’s expired memberships and disable till access.
              </p>
            </div>
            <Button
              variant="secondary"
              loading={running === 'expiry'}
              onClick={() => void runJob('/api/cron/check-expiry', 'expiry')}
            >
              Run now
            </Button>
          </div>
          <div className="border-t border-gray-200 pt-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-gray-900">Send expiry reminders</h3>
              <p className="text-sm text-gray-500">
                Email members at this venue whose membership expires in the next 30 days.
              </p>
            </div>
            <Button
              variant="secondary"
              loading={running === 'reminders'}
              onClick={() => void runJob('/api/cron/send-renewal-reminders', 'reminders')}
            >
              Send reminders
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
