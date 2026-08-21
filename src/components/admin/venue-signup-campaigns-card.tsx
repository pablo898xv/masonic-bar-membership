'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'

type CampaignRow = {
  id: string
  name: string
  token: string
  status: 'ACTIVE' | 'ENDED'
  url: string
  path: string
  createdAt: string
  endedAt: string | null
}

function campaignQrPath(id: string, query: string) {
  return `/api/tenants/current/signup-campaigns/${encodeURIComponent(id)}/qr?${query}`
}

export function VenueSignupCampaignsCard({ onSaved }: { onSaved?: (text: string) => void }) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState('')
  const [poster, setPoster] = useState<CampaignRow | null>(null)
  const [downloading, setDownloading] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const res = await fetch('/api/tenants/current/signup-campaigns')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load signup campaigns')
    setCampaigns(data.campaigns || [])
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load signup campaigns'))
  }, [])

  const createCampaign = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/tenants/current/signup-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Membership campaign' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create signup link')
      setName('')
      await load()
      if (data.campaign?.url) {
        await navigator.clipboard.writeText(data.campaign.url).catch(() => undefined)
        setCopiedId(data.campaign.id)
        setPoster(data.campaign)
      }
      onSaved?.('Signup campaign created. Save the QR code for posters, then end the campaign when the drive is over.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create signup link')
    } finally {
      setSaving(false)
    }
  }

  const copyUrl = async (campaign: CampaignRow) => {
    await navigator.clipboard.writeText(campaign.url)
    setCopiedId(campaign.id)
    onSaved?.('Signup link copied.')
  }

  const downloadQr = async (campaign: CampaignRow, format: 'png' | 'svg') => {
    setDownloading(`${campaign.id}-${format}`)
    setError('')
    try {
      const width = format === 'png' ? 2048 : 1600
      const res = await fetch(campaignQrPath(campaign.id, `format=${format}&width=${width}&download=1`))
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to download QR code')
      }
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const header = res.headers.get('Content-Disposition') || ''
      const named = header.match(/filename="([^"]+)"/)?.[1]
      link.href = href
      link.download = named || `membership-signup.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
      onSaved?.(format === 'svg' ? 'Vector QR code saved.' : 'Poster QR code saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download QR code')
    } finally {
      setDownloading('')
    }
  }

  const endCampaign = async (id: string) => {
    if (!confirm('End this campaign? The signup link and poster QR will stop working immediately.')) return
    setError('')
    try {
      const res = await fetch(`/api/tenants/current/signup-campaigns/${id}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to end campaign')
      if (poster?.id === id) setPoster(null)
      await load()
      onSaved?.('Signup campaign ended. That link and QR can no longer be used to buy a membership.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end campaign')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Signup campaigns</h2>
          <Link href="/admin/reports#campaigns" className="text-sm text-blue-600 hover:underline">
            Sign-up report →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Online self-service purchase is only available through a campaign link. Create a link, save the QR
          code for posters, then end the campaign when you want to stop public buying. There is no permanent
          venue signup URL.
        </p>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
        <form onSubmit={createCampaign} className="flex flex-col sm:flex-row gap-3 items-end">
          <Input
            label="Campaign name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Spring 2026"
            required
          />
          <Button type="submit" loading={saving}>
            Create signup link
          </Button>
        </form>
        {campaigns.length ? (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
            {campaigns.map((campaign) => (
              <li key={campaign.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-3 text-sm">
                <div className="flex items-start gap-3 min-w-0">
                  {campaign.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      onClick={() => setPoster(campaign)}
                      className="shrink-0 rounded-md bg-white p-1 border border-gray-200"
                      title="Open poster QR"
                    >
                      <img
                        src={campaignQrPath(campaign.id, 'width=240')}
                        alt={`${campaign.name} signup QR`}
                        width={72}
                        height={72}
                        className="h-[72px] w-[72px]"
                      />
                    </button>
                  ) : (
                    <div className="h-[72px] w-[72px] shrink-0 rounded-md border border-gray-200 bg-gray-50" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{campaign.name}</p>
                      <Badge variant={campaign.status === 'ACTIVE' ? 'success' : 'default'}>
                        {campaign.status === 'ACTIVE' ? 'Active' : 'Ended'}
                      </Badge>
                    </div>
                    <p className="font-mono text-xs text-gray-500 break-all mt-1">{campaign.url}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {campaign.status === 'ACTIVE' && (
                    <>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setPoster(campaign)}>
                        Poster QR
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void copyUrl(campaign)}>
                        {copiedId === campaign.id ? 'Copied' : 'Copy link'}
                      </Button>
                      <Button type="button" size="sm" variant="danger" onClick={() => void endCampaign(campaign.id)}>
                        End
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No campaigns yet. Create a link when you want members to buy online.</p>
        )}
      </CardContent>

      <Modal isOpen={Boolean(poster)} onClose={() => setPoster(null)} title={poster ? `${poster.name} poster QR` : 'Poster QR'}>
        {poster && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Download a high-resolution PNG for print, or SVG if you are laying this up in a design file. The
              code opens this campaign’s signup link.
            </p>
            <div className="flex justify-center rounded-xl bg-white p-4 border border-gray-200">
              <img
                src={campaignQrPath(poster.id, 'width=640')}
                alt={`${poster.name} signup QR`}
                width={280}
                height={280}
                className="h-[min(17.5rem,70vw)] w-[min(17.5rem,70vw)]"
              />
            </div>
            <p className="font-mono text-xs text-gray-500 break-all text-center">{poster.url}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                loading={downloading === `${poster.id}-svg`}
                onClick={() => void downloadQr(poster, 'svg')}
              >
                Save SVG
              </Button>
              <Button
                type="button"
                loading={downloading === `${poster.id}-png`}
                onClick={() => void downloadQr(poster, 'png')}
              >
                Save PNG
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
