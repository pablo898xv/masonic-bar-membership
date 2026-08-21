'use client'

import { FormEvent, useEffect, useState } from 'react'
import { CARD_PROCESSORS, type CardProcessorId } from '@/lib/card-processors'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type ProcessorView = {
  id: CardProcessorId
  name: string
  description: string
  liveCheckout: boolean
  enabled: boolean
  configured: boolean
  live: boolean
  fields: Record<string, string>
  secretSet: Record<string, boolean>
}

type Draft = ProcessorView & { secretDraft: Record<string, string> }

function statusBadge(processor: Draft) {
  if (processor.live) return <Badge variant="success">Live</Badge>
  if (processor.enabled && processor.configured) return <Badge variant="warning">Saved</Badge>
  if (processor.enabled) return <Badge variant="warning">Incomplete</Badge>
  return <Badge>Off</Badge>
}

export function VenueCardProcessorsCard({ onSaved }: { onSaved?: (text: string) => void }) {
  const [tenantId, setTenantId] = useState('')
  const [defaultProvider, setDefaultProvider] = useState('')
  const [processors, setProcessors] = useState<Draft[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [origin, setOrigin] = useState('')

  const load = async () => {
    const res = await fetch('/api/tenants/current')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load venue')
    const list = (data.tenant.cardPayments?.processors || []) as ProcessorView[]
    setTenantId(data.tenant.id || '')
    setDefaultProvider(data.tenant.cardPayments?.defaultProvider || '')
    setProcessors(
      list.map((item) => ({
        ...item,
        secretDraft: Object.fromEntries(Object.keys(item.secretSet || {}).map((key) => [key, ''])),
      }))
    )
  }

  useEffect(() => {
    setOrigin(window.location.origin)
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load processors'))
  }, [])

  const updateProcessor = (id: CardProcessorId, patch: Partial<Draft>) => {
    setProcessors((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = { defaultProvider: defaultProvider || undefined }
      for (const processor of processors) {
        payload[processor.id] = {
          enabled: processor.enabled,
          ...processor.fields,
          ...processor.secretDraft,
        }
      }
      const res = await fetch('/api/tenants/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardPayments: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save card processors')
      await load()
      onSaved?.('Card processors saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save card processors')
    } finally {
      setSaving(false)
    }
  }

  const enabled = processors.filter((item) => item.enabled)

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-900">Card payment processors</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-6">
          <p className="text-sm text-gray-600">
            Membership card payments settle in the venue’s merchant account on the selected processor, not the open-banking
            payout account above. Stripe Checkout is live. Worldpay, Square, SumUp and Dojo credentials can be saved now
            and switched on when that connector is enabled.
          </p>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

          <Select
            label="Default card processor"
            value={defaultProvider}
            onChange={(event) => setDefaultProvider(event.target.value)}
            options={[
              { value: '', label: enabled.length ? 'First enabled processor' : 'None' },
              ...processors.map((item) => ({
                value: item.id,
                label: `${item.name}${item.live ? ' (live)' : item.enabled ? ' (saved)' : ''}`,
              })),
            ]}
          />

          {processors.map((processor) => {
            const definition = CARD_PROCESSORS.find((item) => item.id === processor.id)
            return (
              <div key={processor.id} className="rounded-xl border border-gray-200 p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{processor.name}</h3>
                      {statusBadge(processor)}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{processor.description}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={processor.enabled}
                      onChange={(event) => {
                        updateProcessor(processor.id, { enabled: event.target.checked })
                        if (event.target.checked && !defaultProvider) setDefaultProvider(processor.id)
                      }}
                    />
                    Enable
                  </label>
                </div>

                {definition?.fields.map((field) =>
                  field.secret ? (
                    <Input
                      key={field.key}
                      label={field.label}
                      type="password"
                      autoComplete="new-password"
                      value={processor.secretDraft[field.key] || ''}
                      placeholder={
                        processor.secretSet[field.key] ? 'Leave blank to keep the current secret' : field.placeholder
                      }
                      onChange={(event) =>
                        updateProcessor(processor.id, {
                          secretDraft: { ...processor.secretDraft, [field.key]: event.target.value },
                        })
                      }
                    />
                  ) : (
                    <Input
                      key={field.key}
                      label={field.label}
                      value={processor.fields[field.key] || ''}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        updateProcessor(processor.id, {
                          fields: { ...processor.fields, [field.key]: event.target.value },
                        })
                      }
                    />
                  )
                )}

                {processor.id === 'stripe' && tenantId && (
                  <div>
                    <p className="block text-sm font-medium text-gray-700 mb-1">Webhook endpoint</p>
                    <p className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 font-mono text-xs text-gray-900 break-all">
                      {origin}/api/payments/stripe/webhook/{tenantId}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Add this URL in the Stripe Dashboard with checkout session completed and expired events.
                    </p>
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Save card processors
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
