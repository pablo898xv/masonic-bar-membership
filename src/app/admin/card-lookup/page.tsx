'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useMsrx6 } from '@/lib/msrx6/use-msrx6'
import { primaryTrack, stripSentinels, tracksMatch, tracksFromMagstripe, formatMagstripeTrackList, type IsoTracks, type MagstripeTrack } from '@/lib/msrx6/protocol'

interface LookupMembership {
  id: string
  status: string
  cardType: string
  paymentStatus?: string
  startDate?: string
  expiryDate?: string
  tillSystemEnabled: boolean
  member: { id: string; name: string; email: string; phone: string } | null
  plan: { id: string; name: string } | null
  issuance: {
    id: string
    queueStatus: string
    magstripeData?: string
    encodedAt?: string
    issuedAt?: string
  } | null
}

interface LookupResult {
  found: boolean
  cardNumber: number
  magstripeData: string
  magstripeTracks?: MagstripeTrack[]
  isAssigned?: boolean
  memberships?: LookupMembership[]
  error?: string
}

function statusVariant(status: string): 'success' | 'info' | 'warning' | 'danger' | 'default' {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PAID') return 'info'
  if (status === 'PENDING_PAYMENT') return 'warning'
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'danger'
  return 'default'
}

function formatDate(value?: string) {
  if (!value) return '—'
  return format(new Date(value), 'dd MMM yyyy')
}

export default function CardLookupPage() {
  const writer = useMsrx6()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [swipedTrack, setSwipedTrack] = useState<string | null>(null)
  const [swipedTracks, setSwipedTracks] = useState<IsoTracks | null>(null)

  const lookup = async (value: string) => {
    const q = value.trim()
    if (!q) {
      setError('Enter a card number or swipe a card')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/card-numbers/lookup?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lookup failed')
      setResult(data)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    setSwipedTrack(null)
    setSwipedTracks(null)
    await lookup(query)
  }

  const handleRead = async () => {
    setReading(true)
    setError('')
    try {
      const tracks = await writer.readCard()
      const raw = primaryTrack(tracks)
      if (!raw) throw new Error('The swipe returned empty tracks. Try again at a steady speed.')
      const display = tracks.track2
        ? `;${stripSentinels(tracks.track2)}`
        : tracks.track1
          ? `%${stripSentinels(tracks.track1)}`
          : `+${stripSentinels(tracks.track3)}`
      setSwipedTracks(tracks)
      setSwipedTrack(display)
      setQuery(display)
      await lookup(raw)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the card')
    } finally {
      setReading(false)
    }
  }

  const expected = result?.magstripeData
  const writeMatch =
    result && swipedTracks
      ? tracksMatch(tracksFromMagstripe(expected || '', result.magstripeTracks), swipedTracks)
      : null
  const trackLabel = formatMagstripeTrackList(result?.magstripeTracks)

  const owner = result?.memberships?.find((item) => item.status === 'ACTIVE') || result?.memberships?.[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Card Lookup</h1>
        <p className="text-gray-500 mt-1">
          Check who a card belongs to, or swipe it on the MSRx6 to verify the magstripe.
          Connect the writer once from the bar at the top of the page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Query</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <Input
                label="Card number or magstripe data"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="1503 or swipe a card"
              />
            </div>
            <Button type="submit" loading={loading}>
              Look up
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleRead}
              loading={reading || writer.phase === 'reading'}
              disabled={!writer.connected}
            >
              Swipe to read
            </Button>
          </form>
          {writer.phase === 'reading' && (
            <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3">
              Swipe the card through the MSRx6 now.
            </p>
          )}
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-900">Card #{result.cardNumber}</h2>
              {result.found ? (
                <Badge variant={result.isAssigned ? 'info' : 'success'}>
                  {result.isAssigned ? 'Assigned' : 'In stock'}
                </Badge>
              ) : (
                <Badge variant="danger">Not in inventory</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Expected {trackLabel}</p>
                <p className="font-mono font-bold text-gray-900 mt-1 break-all">{result.magstripeData}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Swiped</p>
                <p className="font-mono font-bold text-gray-900 mt-1 break-all">{swipedTrack || 'Not swiped yet'}</p>
              </div>
            </div>

            {writeMatch != null && (
              <p className={`text-sm rounded-lg p-3 border ${
                writeMatch
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                {writeMatch
                  ? 'Magstripe matches the expected data. This card is written correctly.'
                  : 'Magstripe does not match. Re-encode this card number.'}
              </p>
            )}

            {!result.found && (
              <p className="text-sm text-gray-600">
                This number is not in card stock. Import it on Card Numbers if it should be part of inventory.
              </p>
            )}

            {result.found && !result.memberships?.length && (
              <p className="text-sm text-gray-600">
                This card is in stock and is not assigned to a member.
              </p>
            )}

            {owner?.member && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">Belongs to</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Member</span>
                    <Link href={`/admin/members/${owner.member.id}`} className="font-medium text-blue-600 hover:underline">
                      {owner.member.name}
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-900">{owner.member.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-gray-900">{owner.member.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <Badge variant={statusVariant(owner.status)}>{owner.status}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Plan</span>
                    <span className="font-medium text-gray-900">{owner.plan?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expiry</span>
                    <span className="font-medium text-gray-900">{formatDate(owner.expiryDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Encode queue</span>
                    <span className="font-medium text-gray-900">
                      {owner.issuance?.queueStatus.replace(/_/g, ' ') || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Till</span>
                    <span className="font-medium text-gray-900">
                      {owner.tillSystemEnabled ? 'Enabled' : 'Not enabled'}
                    </span>
                  </div>
                </div>
                <Link href={`/admin/memberships/${owner.id}`}>
                  <Button size="sm" variant="secondary">View membership</Button>
                </Link>
              </div>
            )}

            {(result.memberships?.length || 0) > 1 && (
              <p className="text-xs text-gray-500">
                This number has {result.memberships!.length} membership records. The active one is shown above.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
