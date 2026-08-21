'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { PublicCardStatus } from '@/components/brand/public-card-status'
import { Button } from '@/components/ui/button'
import { type CardUnavailableReason } from '@/lib/card-unavailable'

interface CardData {
  membershipId: string
  memberName: string
  cardNumber: number
  cardType: 'QR_CODE' | 'PHYSICAL_CARD' | 'BOTH'
  status: string
  planName: string
  expiryDate?: string
  tenantName?: string
  logoUrl?: string
  qrCodeImage: string | null
  appleWalletAvailable: boolean
  googleWalletAvailable: boolean
}

export default function MembershipCardPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const justPaid = searchParams.get('paid') === '1'

  const [card, setCard] = useState<CardData | null>(null)
  const [brand, setBrand] = useState({ venueName: '', logoUrl: '' })
  const [errorReason, setErrorReason] = useState<CardUnavailableReason | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!params.id || !token) {
        setErrorReason('not_found')
        setLoading(false)
        return
      }

      try {
        if (justPaid) {
          await fetch(
            `/api/payments/initiate?membershipId=${encodeURIComponent(params.id)}&token=${encodeURIComponent(token)}`
          )
        }
        const [res, brandingRes] = await Promise.all([
          fetch(`/api/memberships/${params.id}/card?token=${encodeURIComponent(token)}`),
          fetch('/api/branding'),
        ])
        const data = await res.json()
        const branding = brandingRes.ok ? await brandingRes.json() : null
        if (branding?.name) {
          setBrand({ venueName: branding.name, logoUrl: branding.logoUrl || '' })
        }
        if (!res.ok) {
          setErrorReason('not_found')
          return
        }
        setCard(data)
        setBrand({
          venueName: data.tenantName || branding?.name || '',
          logoUrl: data.logoUrl || branding?.logoUrl || '',
        })
      } catch {
        setErrorReason('not_found')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.id, token, justPaid])

  const downloadQr = () => {
    if (!card?.qrCodeImage) return
    const link = document.createElement('a')
    link.href = card.qrCodeImage
    link.download = `masonic-hall-bar-${card.cardNumber}.png`
    link.click()
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (errorReason || !card) {
    return (
      <PublicCardStatus
        reason={errorReason || 'not_found'}
        venueName={brand.venueName}
        logoUrl={brand.logoUrl}
      />
    )
  }

  if (card.status === 'CANCELLED' || card.status === 'EXPIRED') {
    return (
      <PublicCardStatus
        reason={card.status === 'CANCELLED' ? 'revoked' : 'expired'}
        venueName={card.tenantName || brand.venueName}
        logoUrl={card.logoUrl || brand.logoUrl}
      />
    )
  }

  const expiry = card.expiryDate
    ? new Date(card.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="min-h-full bg-gray-50 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-md">
        <p className="text-center text-sm text-gray-500">{card.tenantName || 'Membership Manager'}</p>
        <h1 className="mt-1 text-center text-2xl font-bold">
          {justPaid ? 'You are a member' : 'Your membership card'}
        </h1>
        {justPaid && (
          <p className="mt-2 text-center text-sm text-gray-600">
            Save this page or add the QR code to your phone so you can show it at the bar.
          </p>
        )}

        <div className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
          <div className="px-6 py-5">
            {card.logoUrl ? (
              <img src={card.logoUrl} alt="" className="mb-4 h-14 max-w-[14rem] object-contain" />
            ) : null}
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
            <div className="bg-white dark:bg-white px-6 py-6 text-center">
              <img src={card.qrCodeImage} alt="Membership QR code" className="mx-auto h-56 w-56" />
              <p className="mt-3 text-sm text-slate-600">Show this code at the bar</p>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-slate-300">
              {card.cardType === 'PHYSICAL_CARD'
                ? 'Your physical card is being prepared. Collect it at the bar.'
                : card.status === 'PENDING_PAYMENT'
                  ? 'Payment is still outstanding, so this QR code has not been issued yet.'
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
              className="block"
            >
              <img
                src="/add-to-apple-wallet.svg"
                alt="Add to Apple Wallet"
                className="mx-auto h-12 w-auto"
              />
            </a>
          )}
          {card.googleWalletAvailable && (
            <a
              href={`/api/memberships/${card.membershipId}/google-wallet?token=${encodeURIComponent(token)}`}
              className="block"
            >
              <img
                src="/add-to-google-wallet.svg"
                alt="Add to Google Wallet"
                className="mx-auto h-12 w-auto"
              />
            </a>
          )}
          <p className="text-center text-xs text-gray-500">
            On your phone, tap Share → Add to Home Screen to keep this card handy.
            {card.appleWalletAvailable || card.googleWalletAvailable
              ? ''
              : ' Apple Wallet and Google Wallet can be turned on in Settings once your issuer accounts are approved.'}
          </p>
        </div>
      </div>
    </div>
  )
}
