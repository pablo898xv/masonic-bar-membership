'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface CardData {
  membershipId: string
  memberName: string
  cardNumber: number
  cardType: 'QR_CODE' | 'PHYSICAL_CARD' | 'BOTH'
  status: string
  planName: string
  expiryDate?: string
  qrCodeImage: string | null
  qrPayload: string | null
  appleWalletAvailable: boolean
  googleWalletAvailable: boolean
}

export default function MembershipCardPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const justPaid = searchParams.get('paid') === '1'

  const [card, setCard] = useState<CardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!params.id || !token) {
        setError('This card link is missing or invalid.')
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/memberships/${params.id}/card?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Unable to load card')
        setCard(data)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to load card')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.id, token])

  const downloadQr = () => {
    if (!card?.qrCodeImage) return
    const link = document.createElement('a')
    link.href = card.qrCodeImage
    link.download = `masonic-hall-bar-${card.cardNumber}.png`
    link.click()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-16 text-center text-white">
        <p className="text-red-300">{error || 'Card not found'}</p>
        <Link href="/membership/lookup" className="mt-4 inline-block text-blue-300 underline">
          Look up your card
        </Link>
      </div>
    )
  }

  const expiry = card.expiryDate
    ? new Date(card.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-center text-sm text-slate-400">Membership Manager</p>
        <h1 className="mt-1 text-center text-2xl font-bold">
          {justPaid ? 'You are a member' : 'Your membership card'}
        </h1>
        {justPaid && (
          <p className="mt-2 text-center text-sm text-slate-300">
            Save this page or add the QR code to your phone so you can show it at the bar.
          </p>
        )}

        <div className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl ring-1 ring-white/10">
          <div className="px-6 py-5">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-300">Member</p>
            <p className="mt-1 text-2xl font-semibold">{card.memberName}</p>
            <p className="mt-1 text-slate-400">{card.planName}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 px-6 py-4 text-sm">
            <div>
              <p className="text-slate-400">Card number</p>
              <p className="font-mono text-lg font-bold">{card.cardNumber}</p>
            </div>
            <div>
              <p className="text-slate-400">Valid until</p>
              <p className="font-medium">{expiry}</p>
            </div>
          </div>

          {card.qrCodeImage && card.status === 'ACTIVE' ? (
            <div className="bg-white px-6 py-6 text-center">
              <img src={card.qrCodeImage} alt="Membership QR code" className="mx-auto h-56 w-56" />
              {card.qrPayload && (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Till scan data</p>
                  <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-slate-900">{card.qrPayload}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    iPhone Camera hides the ; and ? around the number. A bar scanner still receives the full string.
                  </p>
                </div>
              )}
              <p className="mt-2 text-sm text-slate-600">Show this code at the bar</p>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-slate-300">
              {card.cardType === 'PHYSICAL_CARD'
                ? 'Your physical card is being prepared. Collect it at the bar.'
                : 'This membership is not active yet.'}
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {card.qrCodeImage && (
            <Button className="w-full" onClick={downloadQr}>
              Save QR code to photos
            </Button>
          )}
          {card.appleWalletAvailable && (
            <a
              href={`/api/memberships/${card.membershipId}/wallet-pass?format=pkpass&token=${encodeURIComponent(token)}`}
              className="block w-full rounded-lg bg-black py-2.5 text-center text-sm font-medium text-white ring-1 ring-white/20"
            >
              Add to Apple Wallet
            </a>
          )}
          {card.googleWalletAvailable && (
            <a
              href={`/api/memberships/${card.membershipId}/google-wallet?token=${encodeURIComponent(token)}`}
              className="block"
            >
              <img
                src="https://developers.google.com/static/wallet/images/add-to-google-wallet-badge.svg"
                alt="Add to Google Wallet"
                className="mx-auto h-12 w-auto"
              />
            </a>
          )}
          <p className="text-center text-xs text-slate-500">
            On your phone, tap Share → Add to Home Screen to keep this card handy.
            {card.appleWalletAvailable || card.googleWalletAvailable
              ? ''
              : ' Apple Wallet and Google Wallet can be turned on in Settings once your issuer accounts are approved.'}
          </p>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/membership/lookup" className="hover:text-slate-300">
            Lost this link? Look up your card
          </Link>
        </p>
      </div>
    </div>
  )
}
