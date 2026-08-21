'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PublicVenueHeader } from '@/components/brand/public-venue-header'
import { cardTypeLabel } from '@/lib/card-type'

interface FoundCard {
  membershipId: string
  cardNumber?: number
  planName?: string
  cardType: string
  status: string
  url: string | null
  renewUrl?: string | null
}

export default function LookupPage() {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [cards, setCards] = useState<FoundCard[] | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setCards(null)

    try {
      const res = await fetch('/api/memberships/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lookup failed')
      setCards(data.cards || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <PublicVenueHeader subtitle="Look up your membership" />

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Find your digital card</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter the email and phone number used when you bought your membership.
            </p>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Phone Number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" loading={submitting}>
                Find my card
              </Button>
            </CardFooter>
          </form>
        </Card>

        {cards && (
          <Card className="mt-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Your memberships</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {cards.length === 0 ? (
                <p className="text-sm text-gray-500">No active memberships found for this account.</p>
              ) : (
                cards.map((card) => (
                  <div key={card.membershipId} className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {card.planName || 'Membership'} · #{card.cardNumber ?? '—'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {cardTypeLabel(card.cardType)} · {card.status}
                      </p>
                    </div>
                    {card.url ? (
                      <Link href={card.url} className="text-sm font-medium text-blue-600 hover:underline">
                        Open card
                      </Link>
                    ) : card.renewUrl ? (
                      <Link href={card.renewUrl} className="text-sm font-medium text-blue-600 hover:underline">
                        Renew
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">Unavailable</span>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          Not a member yet? Speak to the bar manager for a current signup link.
        </p>
      </div>
    </div>
  )
}
