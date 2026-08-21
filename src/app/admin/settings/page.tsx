'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { VenuePaymentsCard } from '@/components/admin/venue-payments-card'
import { VenueCardProcessorsCard } from '@/components/admin/venue-card-processors-card'
import { VenueApiKeysCard } from '@/components/admin/venue-api-keys-card'
import { VenueSignupCampaignsCard } from '@/components/admin/venue-signup-campaigns-card'
import { VenueLogoUpload } from '@/components/admin/venue-logo-upload'
import { Select } from '@/components/ui/select'
import { buildMembershipQrPayload, fillQrRedirectUrl, qrCodeModeOf, qrGatewayPath, qrUsesGateway, type QrCodeMode } from '@/lib/qr-payload'
import {
  formatMagstripeTrackList,
  magstripePrefixIsNumeric,
  normalizeMagstripeTracks,
  withMagstripeSentinels,
  type MagstripeTrack,
} from '@/lib/msrx6/protocol'
import { publicAppBaseUrl } from '@/lib/public-url'
import { PASS_TYPE_OPTIONS, passTypesOf, type VenuePassTypes } from '@/lib/card-type'

type VenueOps = {
  id: string
  slug: string
  magstripePrefix: string
  magstripeTracks: MagstripeTrack[]
  qrCodeMode: QrCodeMode
  qrRedirectUrl: string
  qrScanScript: string
  qrNumberStart: number
  passTypes: VenuePassTypes
  tillSystemApiUrl: string
  tillSystemApiKeySet: boolean
  logoUrl: string
  renewalEmailEnabled: boolean
  renewalSmsEnabled: boolean
}

export default function SettingsPage() {
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [ops, setOps] = useState<VenueOps>({
    id: '',
    slug: '',
    magstripePrefix: ';9998',
    magstripeTracks: [2],
    qrCodeMode: 'TILL',
    qrRedirectUrl: '',
    qrScanScript: '',
    qrNumberStart: 10000,
    passTypes: { qr: true, physical: true, both: false },
    tillSystemApiUrl: '',
    tillSystemApiKeySet: false,
    logoUrl: '',
    renewalEmailEnabled: true,
    renewalSmsEnabled: true,
  })
  const [tillApiKey, setTillApiKey] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch('/api/tenants/current')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load venue')
    setOps({
      id: data.tenant.id || '',
      slug: data.tenant.slug || '',
      magstripePrefix: data.tenant.magstripePrefix || ';9998',
      magstripeTracks: normalizeMagstripeTracks(data.tenant.magstripeTracks),
      qrCodeMode: qrCodeModeOf(data.tenant.qrCodeMode),
      qrRedirectUrl: data.tenant.qrRedirectUrl || '',
      qrScanScript: data.tenant.qrScanScript || '',
      qrNumberStart: Number(data.tenant.qrNumberStart) > 0 ? Number(data.tenant.qrNumberStart) : 10000,
      passTypes: passTypesOf(data.tenant.passTypes),
      tillSystemApiUrl: data.tenant.tillSystemApiUrl || '',
      tillSystemApiKeySet: Boolean(data.tenant.tillSystemApiKeySet),
      logoUrl: data.tenant.logoUrl || '',
      renewalEmailEnabled: data.tenant.renewalEmailEnabled !== false,
      renewalSmsEnabled: data.tenant.renewalSmsEnabled !== false,
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
            : section === 'qr'
              ? {
                  qrCodeMode: ops.qrCodeMode,
                  qrRedirectUrl: ops.qrRedirectUrl,
                  qrScanScript: ops.qrScanScript,
                  qrNumberStart: ops.qrNumberStart,
                }
            : section === 'passes'
              ? { passTypes: ops.passTypes }
            : section === 'reminders'
              ? {
                  renewalEmailEnabled: ops.renewalEmailEnabled,
                  renewalSmsEnabled: ops.renewalSmsEnabled,
                }
            : {
                magstripePrefix: ops.magstripePrefix.trim() || ';9998',
                magstripeTracks: ops.magstripeTracks,
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
  const qrPreview = buildMembershipQrPayload({
    cardNumber: 1500,
    magstripePrefix: ops.magstripePrefix,
    qrCodeMode: ops.qrCodeMode,
    qrRedirectUrl: ops.qrRedirectUrl,
    membershipId: 'example',
    shortCode: 'abc12345',
    tenantSlug: ops.slug || 'venue',
    gatewayUrl: `${publicAppBaseUrl()}${qrGatewayPath({
      tenantSlug: ops.slug || 'venue',
      cardNumber: 1500,
      shortCode: 'abc12345',
    })}`,
  })
  const qrDestination =
    ops.qrCodeMode === 'URL' && ops.qrRedirectUrl.trim()
      ? fillQrRedirectUrl(ops.qrRedirectUrl, {
          cardNumber: 1500,
          membershipId: 'example',
          shortCode: 'abc12345',
          tenantSlug: ops.slug || 'venue',
        })
      : ''
  const trackLabel = formatMagstripeTrackList(ops.magstripeTracks)
  const numericPrefix = magstripePrefixIsNumeric(ops.magstripePrefix)
  const needsNumericPrefix =
    !numericPrefix && (ops.magstripeTracks.includes(2) || ops.magstripeTracks.includes(3))

  const toggleTrack = (track: MagstripeTrack) => {
    setOps((current) => {
      const selected = current.magstripeTracks.includes(track)
        ? current.magstripeTracks.filter((item) => item !== track)
        : [...current.magstripeTracks, track].sort()
      return { ...current, magstripeTracks: selected.length ? selected : [track] }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Venue settings</h1>
        <p className="text-gray-500 mt-1">
          Branding, signup campaigns, payout account, card processors, till, QR, magstripe, and membership reminders for this venue.
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

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Venue logo</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Used on the purchase screens, this admin site, and the Apple/Google Wallet pass.
            Google Wallet keeps this venue’s cards in their own group. Apple Wallet still stacks them with other
            Membership Manager cards because they share one platform Pass Type certificate — the pass itself shows
            this venue’s name and logo.
          </p>
          {ops.id ? (
            <VenueLogoUpload
              tenantId={ops.id}
              logoUrl={ops.logoUrl}
              onUpdated={(logoUrl) => setOps((current) => ({ ...current, logoUrl }))}
            />
          ) : (
            <p className="text-sm text-gray-500">Loading venue…</p>
          )}
        </CardContent>
      </Card>

      <VenueSignupCampaignsCard onSaved={(text) => setMessage({ type: 'ok', text })} />

      <VenuePaymentsCard onSaved={(text) => setMessage({ type: 'ok', text })} />

      <VenueCardProcessorsCard onSaved={(text) => setMessage({ type: 'ok', text })} />

      <VenueApiKeysCard onSaved={(text) => setMessage({ type: 'ok', text })} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Magstripe card configuration</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => saveOps(event, 'magstripe')} className="space-y-4">
              <p className="text-sm text-gray-600">
                Data written to physical cards for this venue. The prefix is followed by the number printed on the back of the card, then a <span className="font-mono">?</span> end sentinel. That <span className="font-mono">?</span> is encoded on the magnetic track and comes back when the card is swiped. Choose which ISO tracks the writer should encode.
              </p>
              <div className="grid grid-cols-1 gap-4">
                <Input
                  label="Magstripe prefix"
                  value={ops.magstripePrefix}
                  onChange={(event) => setOps({ ...ops, magstripePrefix: event.target.value })}
                  className="font-mono"
                />
                <fieldset>
                  <legend className="block text-sm font-medium text-gray-700 mb-2">Tracks to encode</legend>
                  <div className="space-y-2">
                    {(
                      [
                        [1, 'Track 1 — alphanumeric (IATA)'],
                        [2, 'Track 2 — numeric (typical till swipe)'],
                        [3, 'Track 3 — numeric'],
                      ] as const
                    ).map(([track, label]) => (
                      <label key={track} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={ops.magstripeTracks.includes(track)}
                          onChange={() => toggleTrack(track)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {needsNumericPrefix && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    {trackLabel} only accept digits. Use a numeric prefix, or encode Track 1 only.
                  </p>
                )}
                <div>
                  <p className="block text-sm font-medium text-gray-700 mb-1">
                    Example card 1500 ({trackLabel})
                  </p>
                  <p className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 font-mono text-gray-900">
                    {withMagstripeSentinels(`${ops.magstripePrefix || ';9998'}1500`)}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={saving === 'magstripe'} disabled={needsNumericPrefix}>
                  Save magstripe settings
                </Button>
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
          <h2 className="text-lg font-semibold text-gray-900">Pass types</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => saveOps(event, 'passes')} className="space-y-4">
            <p className="text-sm text-gray-600">
              Choose which memberships people can buy on the public signup form. Turn off any this venue does not issue.
            </p>
            <div className="space-y-3">
              {PASS_TYPE_OPTIONS.map((option) => {
                const key = option.value === 'QR_CODE' ? 'qr' : option.value === 'PHYSICAL_CARD' ? 'physical' : 'both'
                return (
                  <label key={option.value} className="flex items-start gap-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={ops.passTypes[key]}
                      onChange={(event) =>
                        setOps({
                          ...ops,
                          passTypes: { ...ops.passTypes, [key]: event.target.checked },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium text-gray-900">{option.label}</span>
                      <span className="block text-xs text-gray-500">{option.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={saving === 'passes'}>Save pass types</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">QR code</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => saveOps(event, 'qr')} className="space-y-4">
            <p className="text-sm text-gray-600">
              What a phone or scanner should do when it reads this venue’s membership QR. URL and script
              modes encode a short link on this platform that includes this venue and the card number, so two
              venues can both have card 1500 without mixing them up.
            </p>
            <Input
              label="QR-only card numbers start at"
              type="number"
              min={1}
              step={1}
              value={ops.qrNumberStart}
              onChange={(event) =>
                setOps({
                  ...ops,
                  qrNumberStart: Math.max(1, parseInt(event.target.value, 10) || 1),
                })
              }
              className="font-mono"
            />
            <p className="text-xs text-gray-500 -mt-2">
              Digital QR memberships take the next unused number from this value, skipping anything already imported as printed stock. Keep this above your physical card range (for example 10000 if stock is 1500–1999).
            </p>
            <Select
              label="When scanned"
              value={ops.qrCodeMode}
              onChange={(event) =>
                setOps({ ...ops, qrCodeMode: qrCodeModeOf(event.target.value) })
              }
              options={[
                { value: 'TILL', label: 'Till / magstripe string (compatible with bar tills)' },
                { value: 'URL', label: 'Open a web page via this platform (venue + card link)' },
                { value: 'SCRIPT', label: 'Custom landing page script' },
              ]}
            />
            {ops.qrCodeMode === 'URL' && (
              <Input
                label="Destination web page"
                value={ops.qrRedirectUrl}
                onChange={(event) => setOps({ ...ops, qrRedirectUrl: event.target.value })}
                placeholder="https://example.com/join?ref={cardNumber}"
                className="font-mono"
              />
            )}
            {ops.qrCodeMode === 'URL' && (
              <p className="text-xs text-gray-500">
                The QR contains <span className="font-mono">/q/{ops.slug || 'venue'}/1500</span> for this
                venue. On scan we redirect here. Placeholders:{' '}
                {'{cardNumber}'}, {'{membershipNumber}'}, {'{membershipId}'}, {'{shortCode}'}, {'{tenant}'}.
                If you omit them, <code>membershipNumber</code> is added as a query parameter.
              </p>
            )}
            {ops.qrCodeMode === 'SCRIPT' && (
              <div>
                <label htmlFor="qr-scan-script" className="block text-sm font-medium text-gray-700 mb-1">
                  Landing page script
                </label>
                <textarea
                  id="qr-scan-script"
                  value={ops.qrScanScript}
                  onChange={(event) => setOps({ ...ops, qrScanScript: event.target.value })}
                  rows={12}
                  spellCheck={false}
                  placeholder={`fetch('https://example.com/check-in', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, mobile, email, cardNumber })
})`}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg shadow-sm bg-white dark:bg-slate-900 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Runs in the member’s browser when this venue’s QR is opened. Variables in scope:{' '}
                  <code>name</code>, <code>mobile</code>, <code>email</code>, <code>cardNumber</code>, and{' '}
                  <code>phone</code>. The full record is <code>membership</code> (including{' '}
                  <code>planName</code>, <code>status</code>, <code>expiry</code>, <code>tenant</code>).
                  Same QR encoding as URL mode, so switching between them does not need new cards. Anyone
                  who opens the link can see these fields — use this at the door, not as a public page.
                </p>
              </div>
            )}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">
                {qrUsesGateway(ops.qrCodeMode) ? 'Encoded in the QR (example card 1500)' : 'Example card 1500'}
              </p>
              <p className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 font-mono text-gray-900 break-all text-sm">
                {qrPreview}
              </p>
            </div>
            {ops.qrCodeMode === 'URL' && qrDestination && (
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-1">Currently redirects to</p>
                <p className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 font-mono text-gray-900 break-all text-sm">
                  {qrDestination}
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <Button type="submit" loading={saving === 'qr'}>Save QR settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Membership reminders</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Check expired memberships</h3>
              <p className="text-sm text-gray-500">
                Mark this venue’s expired memberships and disable till access.
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full sm:w-auto shrink-0"
              loading={running === 'expiry'}
              onClick={() => void runJob('/api/cron/check-expiry', 'expiry')}
            >
              Run now
            </Button>
          </div>
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <form onSubmit={(event) => saveOps(event, 'reminders')} className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">Expiry reminders</h3>
                <p className="text-sm text-gray-500">
                  Members whose card expires in the next 30 days. They keep the same card number; the extra
                  year is added from the current expiry, not from the day they pay.
                </p>
              </div>
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ops.renewalEmailEnabled}
                  onChange={(event) => setOps({ ...ops, renewalEmailEnabled: event.target.checked })}
                />
                <span>
                  <span className="font-medium text-gray-900">Email</span>
                  <span className="block text-xs text-gray-500">Send the renewal reminder email with a renew link.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ops.renewalSmsEnabled}
                  onChange={(event) => setOps({ ...ops, renewalSmsEnabled: event.target.checked })}
                />
                <span>
                  <span className="font-medium text-gray-900">Text message</span>
                  <span className="block text-xs text-gray-500">
                    SMS to UK mobiles. Platform SMS must also be on, and this uses venue SMS credits.
                  </span>
                </span>
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button type="submit" variant="secondary" loading={saving === 'reminders'}>
                  Save reminder settings
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto shrink-0"
                  loading={running === 'reminders'}
                  disabled={!ops.renewalEmailEnabled && !ops.renewalSmsEnabled}
                  onClick={() => void runJob('/api/cron/send-renewal-reminders', 'reminders')}
                >
                  Send reminders
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
